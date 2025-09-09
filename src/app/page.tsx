
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Progress } from "@/components/ui/progress";
import { Gift } from 'lucide-react';

// --- Spinner Wheel Component ---
const SpinnerWheel = ({ onSpin, isSpinning, result }: { onSpin: () => void; isSpinning: boolean; result: number | null }) => {
  const segments = [500, 100, 400, 200, 300];
  const segmentColors = ["#FFD700", "#FF6347", "#ADFF2F", "#1E90FF", "#BA55D3"];
  const segmentAngle = 360 / segments.length;
  
  // Calculate the final rotation angle based on the result
  const getRotationAngle = () => {
    if (result === null) return 0;
    const index = segments.indexOf(result);
    // Add randomness to the final position within the segment
    const randomOffset = (Math.random() - 0.5) * (segmentAngle * 0.8);
    // Base rotation + segment position + random offset + extra spins for animation
    return 360 * 5 + (360 - (index * segmentAngle)) + randomOffset;
  };

  const rotationStyle = {
    transform: `rotate(${isSpinning ? getRotationAngle() : 0}deg)`,
    transition: isSpinning ? 'transform 6s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative w-72 h-72 md:w-80 md:h-80">
        <div 
          className="absolute w-full h-full rounded-full border-4 border-primary shadow-lg"
          style={rotationStyle}
        >
          {segments.map((segment, index) => (
            <div
              key={index}
              className="absolute w-1/2 h-1/2 origin-bottom-right flex items-center justify-center"
              style={{
                transform: `rotate(${index * segmentAngle}deg)`,
                clipPath: `polygon(100% 0, 0 100%, 100% 100%)`,
                backgroundColor: segmentColors[index],
              }}
            >
              <span 
                className="text-lg font-bold text-white -rotate-45" 
                style={{ transform: `rotate(${-segmentAngle / 2}deg) translate(-50%, -20%)`}}
              >
                {segment}
              </span>
            </div>
          ))}
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border-4 border-primary z-10"></div>
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-[20px] border-t-primary z-20"></div>
      </div>
      <button className="btn btn-primary" onClick={onSpin} disabled={isSpinning}>
        {isSpinning ? '...جاري الدوران' : 'لف العجلة!'}
      </button>
    </div>
  );
};


// --- Main App Component ---
export default function Home() {
  // --- State Variables ---
  const [userId, setUserId] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  // Spinner State
  const [spinsLeft, setSpinsLeft] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showSpinnerDialog, setShowSpinnerDialog] = useState(false);
  const [spinResult, setSpinResult] = useState<number | null>(null);


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
  const SPINS_PER_DAY = 5;
  
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
              // User exists, load their data
              const userData = userDocSnap.data();
              setPoints(userData.points || 0);

              // --- Check and reset spins ---
              const lastSpin = userData.lastSpinDate?.toDate();
              const now = new Date();
              const oneDay = 24 * 60 * 60 * 1000;

              if (!lastSpin || (now.getTime() - lastSpin.getTime()) > oneDay) {
                // If more than 24 hours have passed, reset spins
                await updateDoc(userDocRef, { spinsLeft: SPINS_PER_DAY });
                setSpinsLeft(SPINS_PER_DAY);
              } else {
                setSpinsLeft(userData.spinsLeft ?? 0);
              }

            } else {
              // New user, create their document in Firestore
              await setDoc(userDocRef, {
                points: 0,
                telegramUsername: telegramUser.username || '',
                telegramFirstName: telegramUser.first_name || '',
                telegramLastName: telegramUser.last_name || '',
                createdAt: serverTimestamp(),
                spinsLeft: SPINS_PER_DAY,
                lastSpinDate: null,
              });
              setPoints(0);
              setSpinsLeft(SPINS_PER_DAY);
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

  const handleSpin = async () => {
    if (isSpinning || spinsLeft <= 0 || !userId) return;

    setIsSpinning(true);
    setSpinResult(null);

    const segments = [500, 100, 400, 200, 300];
    const prize = segments[Math.floor(Math.random() * segments.length)];
    setSpinResult(prize);

    const newPoints = points + prize;
    const newSpinsLeft = spinsLeft - 1;

    // After animation finishes (6 seconds)
    setTimeout(async () => {
      try {
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, {
          points: newPoints,
          spinsLeft: newSpinsLeft,
          lastSpinDate: serverTimestamp(),
        });
        setPoints(newPoints);
        setSpinsLeft(newSpinsLeft);
        showToast(`مبروك! لقد ربحت ${prize} نقطة!`);
      } catch (error) {
        console.error("Error updating points after spin:", error);
        showToast("فشل تحديث نقاطك بعد اللفة، يرجى المحاولة مرة أخرى.", true);
      } finally {
        setIsSpinning(false);
        setTimeout(() => setShowSpinnerDialog(false), 1000); // Close dialog after a short delay
      }
    }, 6500); // A bit longer than the animation
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
      {/* --- Spinner Floating Button --- */}
      {!isLoading && !error && (
        <button 
          onClick={() => setShowSpinnerDialog(true)}
          className={`fixed bottom-6 left-6 z-40 w-16 h-16 rounded-full shadow-lg flex items-center justify-center text-white transition-all ${spinsLeft > 0 ? 'bg-primary animate-pulse' : 'bg-muted'}`}
          aria-label="عجلة الحظ"
        >
          <Gift size={32} />
          {spinsLeft > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-background">
              {spinsLeft}
            </span>
          )}
        </button>
      )}

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

        {/* --- Spinner Dialog --- */}
        {showSpinnerDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
            <div className="card sm:max-w-md w-full m-4 p-6 relative">
               <button onClick={() => setShowSpinnerDialog(false)} className="absolute top-4 left-4 text-muted-foreground hover:text-foreground">&times;</button>
               <div className="flex flex-col space-y-2 text-center mb-6">
                <h2 className="text-lg font-semibold leading-none tracking-tight" style={{ fontWeight: 600 }}>عجلة الحظ</h2>
                <p className="text-sm text-muted-foreground">لديك {spinsLeft} لفة متبقية. حظ موفق!</p>
              </div>
               {spinsLeft > 0 ? (
                 <SpinnerWheel onSpin={handleSpin} isSpinning={isSpinning} result={spinResult} />
               ) : (
                <div className='text-center p-8'>
                  <p>لقد استهلكت جميع لفاتك لهذا اليوم. عد غدًا للمزيد!</p>
                </div>
               )}
            </div>
          </div>
        )}

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

    