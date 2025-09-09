
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Progress } from "@/components/ui/progress";

// --- Main App Component ---
export default function Home() {
  // --- State Variables ---
  const [userId, setUserId] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [toast, setToast] = useState({ message: '', show: false, isError: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Splash Screen State
  const [showSplash, setShowSplash] = useState(true);
  const [progress, setProgressState] = useState(0);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // --- Constants ---
  const AD_REWARD = 10;
  const COOLDOWN_SECONDS = 10;
  const MIN_WITHDRAWAL_POINTS = 50000;
  const SPLASH_DURATION = 2500;
  
  // --- IMPORTANT: Configure Telegram Bot here ---
  const TELEGRAM_BOT_TOKEN = '8400968082:AAH_eTO1Bmjw1KwjgDJHBji8ZyXvtVnb16g';
  const TELEGRAM_CHAT_ID = '7519641546';

  // --- Functions ---

  const showToast = (message: string, isError = false) => {
    setToast({ message, show: true, isError });
    setTimeout(() => {
      setToast({ message: '', show: false, isError: false });
    }, 3000);
  };
  
  // Effect for splash screen
  useEffect(() => {
    // Clear any old data from localStorage to ensure a fresh start with Firebase
    localStorage.clear();
    
    const progressInterval = setInterval(() => {
      setProgressState(prev => Math.min(prev + 100 / (SPLASH_DURATION / 100), 100));
    }, 100);

    const splashTimeout = setTimeout(() => {
      setShowSplash(false);
      clearInterval(progressInterval);
    }, SPLASH_DURATION);

    return () => {
      clearTimeout(splashTimeout);
      clearInterval(progressInterval);
    };
  }, []);

  // Main effect for user initialization with Firestore
  useEffect(() => {
    if (showSplash) return; // Wait for splash screen to finish

    // --- The Official & Correct way to initialize Telegram Web App ---
    try {
        if (typeof window.Telegram === 'undefined' || !window.Telegram.WebApp) {
             setError("يرجى فتح هذا التطبيق من داخل تيليجرام.");
             setIsLoading(false);
             return;
        }

        const tg = window.Telegram.WebApp;
        
        // This function tells Telegram we are ready, and it can show the main button etc.
        tg.ready();

        // --- Now, safely get the user data ---
        const telegramUser = tg.initDataUnsafe?.user;

        if (!telegramUser || !telegramUser.id) {
            setError("لا يمكن التعرف على حساب تيليجرام الخاص بك. حاول إعادة تشغيل البوت.");
            setIsLoading(false);
            return;
        }
        
        const telegramUserId = telegramUser.id.toString();
        setUserId(telegramUserId); // Set userId in state

        // --- This is the core logic to connect to Firestore ---
        const fetchUserData = async () => {
          setIsLoading(true);
          try {
            const userDocRef = doc(db, "users", telegramUserId);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
              // User exists, load their points
              setPoints(userDocSnap.data().points || 0);
            } else {
              // New user, create their document in Firestore
              await setDoc(userDocRef, {
                points: 0,
                telegramUsername: telegramUser.username || '',
                telegramFirstName: telegramUser.first_name || '',
                telegramLastName: telegramUser.last_name || '',
                createdAt: serverTimestamp(),
              });
              setPoints(0);
            }
          } catch (e) {
            console.error("Error fetching or creating user data:", e);
            setError("حدث خطأ أثناء تحميل بياناتك من السيرفر. تأكد أنك أنشأت قاعدة البيانات في وضع الاختبار.");
          } finally {
            setIsLoading(false);
          }
        };

        fetchUserData();

    } catch (e) {
        console.error("A critical error occurred during initialization:", e);
        setError("حدث خطأ فادح. يرجى فتح التطبيق من داخل تيليجرام.");
        setIsLoading(false);
    }

  }, [showSplash]); // This effect runs only once after the splash screen.

  // Cooldown timer effect
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleWatchAd = async () => {
    if (cooldown > 0 || !userId) return;

    // Optimistic update for instant UI feedback
    const newPoints = points + AD_REWARD;
    setPoints(newPoints);
    setCooldown(COOLDOWN_SECONDS);

    try {
        const userDocRef = doc(db, "users", userId);
        // --- CRITICAL FIX: Use `newPoints` for the update ---
        await updateDoc(userDocRef, {
            points: newPoints
        });
    } catch (error) {
        console.error("Error updating points in Firestore:", error);
        // Revert optimistic update on error
        setPoints(points); 
        showToast("فشل تحديث نقاطك، يرجى المحاولة مرة أخرى.", true);
    }
  };

  const validateForm = () => {
    let isValid = true;
    setNameError('');
    setPhoneError('');
    if (name.trim().length < 2) {
      setNameError('يجب أن يكون الاسم حرفين على الأقل.');
      isValid = false;
    }
    const phoneRegex = /^(05|06|07)\d{8}$/;
    if (!phoneRegex.test(phone)) {
      setPhoneError('الرجاء إدخال رقم هاتف جزائري صحيح.');
      isValid = false;
    }
    return isValid;
  }

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !userId) return;
    
    setIsSubmitting(true);
    
    let currentPointsOnServer = 0;
    try {
        // --- Secure way: Re-fetch points from server before processing ---
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            currentPointsOnServer = userDocSnap.data().points || 0;
        } else {
            throw new Error("User not found on server.");
        }
    } catch (error) {
        console.error("Error fetching points for withdrawal:", error);
        showToast("فشل التحقق من رصيدك. حاول مرة أخرى.", true);
        setIsSubmitting(false);
        return;
    }

    if (currentPointsOnServer < MIN_WITHDRAWAL_POINTS) {
      showToast(`تحتاج إلى ${MIN_WITHDRAWAL_POINTS.toLocaleString()} نقطة على الأقل للسحب.`, true);
      setIsSubmitting(false);
      return;
    }
    
    const message = `
    طلب سحب جديد من "أربح فليكسي"
    ---------------------------------
    👤 الاسم: ${name}
    📱 رقم الهاتف: ${phone}
    💰 النقاط (من السيرفر): ${currentPointsOnServer.toLocaleString()}
    🆔 معرف المستخدم: ${userId}
    ---------------------------------
    `;

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'Markdown',
        }),
      });

      const data = await response.json();

      if (data.ok) {
        // --- Update points on server after successful withdrawal ---
        const userDocRef = doc(db, "users", userId);
        const newPointsAfterWithdrawal = currentPointsOnServer - MIN_WITHDRAWAL_POINTS;
        await updateDoc(userDocRef, { points: newPointsAfterWithdrawal });
        
        // Update local state to match server
        setPoints(newPointsAfterWithdrawal);
        
        showToast('تم إرسال طلب السحب الخاص بك بنجاح.');
        setShowWithdrawalDialog(false);
        setName('');
        setPhone('');
      } else {
        throw new Error(data.description || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send withdrawal request:', error);
      showToast('فشل إرسال طلب السحب. يرجى المحاولة مرة أخرى.', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render Logic ---

  if (showSplash) {
    return (
      <div id="splash-screen" className="flex flex-col items-center justify-center min-h-screen bg-background p-8">
        <div className="text-center w-full max-w-sm">
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-6">أربح فليكسي</h1>
          <Progress value={progress} className="w-full h-2" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div dir="rtl">
        <div id="main-app" className="p-4 flex flex-col items-center min-h-screen">
          <main className="w-full max-w-md mx-auto">
            <header className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-foreground text-right flex-grow">أربح فليكسي</h1>
              <div className="card shadow-lg">
                <div className="p-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  <span id="points-display" className="text-xl font-bold">{points.toLocaleString()}</span>
                </div>
              </div>
            </header>
            
            {isLoading ? (
               <div className="card w-full shadow-xl flex items-center justify-center p-20">
                    <p>جاري التحميل من السيرفر...</p>
               </div>
            ) : error ? (
               <div className="card w-full shadow-xl flex items-center justify-center p-20 bg-destructive/20">
                    <p className="text-destructive font-semibold text-center">{error}</p>
               </div>
            ) : (
                <div className="card w-full shadow-xl">
                  <div className="p-6">
                    <h2 className="text-center text-xl font-semibold" style={{ fontWeight: 600 }}>اكسب نقاطك</h2>
                  </div>
                  <div className="p-6 pt-0 flex flex-col gap-6">
                    <div className="text-center p-6 rounded-lg bg-secondary/50">
                      <p className="text-lg text-muted-foreground">شاهد إعلانًا واحصل على</p>
                      <p id="ad-reward-display" className="text-3xl font-bold text-primary">{AD_REWARD} نقطة</p>
                    </div>

                    <button id="watch-ad-btn" className="btn btn-primary" onClick={handleWatchAd} disabled={cooldown > 0}>
                      {cooldown > 0 ? `انتظر ${cooldown} ثانية...` : 'مشاهدة إعلان'}
                    </button>

                    <button id="open-withdrawal-btn" className="btn btn-outline" onClick={() => setShowWithdrawalDialog(true)}>
                      سحب الرصيد
                    </button>
                  </div>
                </div>
            )}
          </main>
        </div>

        {showWithdrawalDialog && (
          <div id="withdrawal-dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
            <div className="card sm:max-w-sm w-full m-4">
              <div className="flex flex-col space-y-1.5 p-6 text-center sm:text-right">
                <h2 className="text-lg font-semibold leading-none tracking-tight" style={{ fontWeight: 600 }}>طلب سحب الرصيد</h2>
                <p className="text-sm text-muted-foreground">أدخل معلوماتك لإكمال عملية السحب.</p>
              </div>
              <div className="p-6 pt-0">
                <form id="withdrawal-form" className="space-y-4" onSubmit={handleWithdrawalSubmit}>
                  <div>
                    <label htmlFor="name" className="text-sm font-medium leading-none">الاسم الكامل</label>
                    <input type="text" id="name" name="name" className="input mt-2" placeholder="ادخل اسمك" required value={name} onChange={(e) => setName(e.target.value)} />
                    <p id="name-error" className="text-sm font-medium text-red-600 mt-1">{nameError}</p>
                  </div>
                  <div>
                    <label htmlFor="phone" className="text-sm font-medium leading-none">رقم الهاتف</label>
                    <input type="tel" id="phone" name="phone" className="input mt-2" placeholder="ادخل رقم هاتفك" required value={phone} onChange={(e) => setPhone(e.target.value)} />
                    <p id="phone-error" className="text-sm font-medium text-red-600 mt-1">{phoneError}</p>
                  </div>
                  <div className="text-xs space-y-2 p-3 rounded-md border bg-secondary/50 text-muted-foreground">
                    <p>• يجب أن يكون رقم الهاتف جيزي أو أوريدو أو موبيليس.</p>
                    <p>• الحد الأدنى للسحب هو <span className="font-bold text-primary">{MIN_WITHDRAWAL_POINTS.toLocaleString()}</span> نقطة.</p>
                    <p>• كل <span className="font-bold text-primary">50,000</span> نقطة تساوي <span className="font-bold text-primary">100 دج</span> فليكسي.</p>
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
                    <button type="button" id="cancel-withdrawal-btn" className="btn btn-outline mt-2 sm:mt-0" onClick={() => setShowWithdrawalDialog(false)} disabled={isSubmitting}>إلغاء</button>
                    <button type="submit" id="submit-withdrawal-btn" className="btn btn-primary" disabled={isSubmitting || points < MIN_WITHDRAWAL_POINTS}>
                      {isSubmitting ? 'جاري الإرسال...' : 'تأكيد السحب'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {toast.show && (
          <div id="toast" className={`fixed top-6 right-6 p-4 rounded-md shadow-lg z-[100] ${toast.isError ? 'bg-destructive text-destructive-foreground' : 'bg-gray-800 text-white'}`}>
            <p id="toast-message">{toast.message}</p>
          </div>
        )}
      </div>
    </>
  );
}

    