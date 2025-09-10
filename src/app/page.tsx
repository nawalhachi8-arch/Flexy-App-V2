
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { Gift, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

declare global {
    interface Window {
        Telegram: any;
        show_9854021: (options?: any) => Promise<void>;
    }
}

// --- Spinner Wheel Component ---
const SpinnerWheel = ({ onSpin, isSpinning, result }: { onSpin: () => void; isSpinning: boolean; result: number | null }) => {
    const segments = [500, 100, 400, 200, 300];
    const segmentColors = ["#FFD700", "#FF6347", "#ADFF2F", "#1E90FF", "#BA55D3"];
    const segmentAngle = 360 / segments.length;
    
    const getRotationAngle = () => {
        if (result === null) return 0;
        const resultIndex = segments.indexOf(result);
        const baseAngle = 360 - (resultIndex * segmentAngle);
        const randomOffsetInSegment = (Math.random() - 0.5) * (segmentAngle * 0.8);
        const fullSpins = 360 * 5;
        
        return fullSpins + baseAngle + randomOffsetInSegment;
    };

    const rotationStyle = {
        transform: `rotate(${isSpinning ? getRotationAngle() : 0}deg)`,
        transition: isSpinning ? 'transform 6s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
    };

    return (
        <div className="flex flex-col items-center gap-8">
            <div className="relative w-72 h-72 md:w-80 md:h-80">
                <div 
                    className="absolute w-full h-full rounded-full border-4 border-primary shadow-lg overflow-hidden"
                    style={rotationStyle}
                >
                    {segments.map((segment, index) => (
                        <div
                            key={index}
                            className="absolute w-1/2 h-1/2 origin-bottom-right flex items-center justify-center"
                            style={{
                                transform: `rotate(${index * segmentAngle}deg) skewY(${segmentAngle - 90}deg)`,
                                backgroundColor: segmentColors[index],
                            }}
                        >
                            <span 
                                className="text-xl font-bold text-white" 
                                style={{ 
                                    transform: `skewY(${90 - segmentAngle}deg) rotate(${segmentAngle / 2}deg) translate(-50%, -10%)`,
                                    textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
                                }}
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
  const [userId, setUserId] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [spinsLeft, setSpinsLeft] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showSpinnerDialog, setShowSpinnerDialog] = useState(false);
  const [spinResult, setSpinResult] = useState<number | null>(null);
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [toast, setToast] = useState({ message: '', show: false, isError: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgressState] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  
  const [appStatus, setAppStatus] = useState<'splash' | 'loading' | 'ready' | 'error'>('splash');


  const AD_REWARD = 10;
  const COOLDOWN_SECONDS = 10;
  const MIN_WITHDRAWAL_POINTS = 50000;
  const SPLASH_DURATION = 2500;
  const SPINS_PER_DAY = 5;
  const TELEGRAM_BOT_TOKEN = '8400968082:AAH_eTO1Bmjw1KwjgDJHBji8ZyXvtVnb16g';
  const TELEGRAM_CHAT_ID = '7519641546';

  const showToast = (message: string, isError = false) => {
    setToast({ message, show: true, isError });
    setTimeout(() => {
      setToast({ message: '', show: false, isError: false });
    }, 3000);
  };
  
  useEffect(() => {
    const initApp = async () => {
      let telegramUser: any = null;
      let devMode = false;
  
      if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        telegramUser = tg.initDataUnsafe.user;
      } else {
        devMode = true;
        console.warn("Telegram Web App not found. Running in development mode.");
      }
      
      if (telegramUser && telegramUser.id) {
        const telegramUserId = telegramUser.id.toString();
        setUserId(telegramUserId);
        await fetchUserData(telegramUserId, telegramUser);
      } else if (devMode) {
        const devUserId = "dev_user_123";
        setUserId(devUserId);
        const devUser = { id: devUserId, username: 'devuser', first_name: 'Dev', last_name: 'User' };
        await fetchUserData(devUserId, devUser);
      }
      else {
        setError("يرجى فتح هذا التطبيق من داخل تيليجرام.");
        setAppStatus('error');
      }
    };
  
    const fetchUserData = async (currentUserId: string, telegramUser: any) => {
      try {
        const userDocRef = doc(db, 'users', currentUserId);
        const userDocSnap = await getDoc(userDocRef);
  
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setPoints(userData.points || 0);
          
          const today = new Date().toISOString().split('T')[0];
          if (userData.lastSpinDate === today) {
            setSpinsLeft(userData.spinsLeftToday);
          } else {
            setSpinsLeft(SPINS_PER_DAY);
          }
        } else {
          await setDoc(userDocRef, {
            points: 0,
            spinsLeftToday: SPINS_PER_DAY,
            lastSpinDate: new Date().toISOString().split('T')[0],
            createdAt: serverTimestamp(),
            username: telegramUser.username || '',
            firstName: telegramUser.first_name || '',
            lastName: telegramUser.last_name || '',
          });
          setPoints(0);
          setSpinsLeft(SPINS_PER_DAY);
        }
        setAppStatus('ready');
      } catch (e: any) {
        console.error("Error fetching user data:", e);
        setError(`تعذر جلب البيانات. تأكد من أن قواعد الأمان في Firebase تسمح بالقراءة والكتابة.`);
        setAppStatus('error');
      }
    };

    if (appStatus === 'loading') {
       initApp();
    }
  }, [appStatus]);

  useEffect(() => {
    if(appStatus === 'splash') {
        const progressInterval = setInterval(() => {
            setProgressState(prev => Math.min(prev + 100 / (SPLASH_DURATION / 100), 100));
        }, 100);

        const splashTimeout = setTimeout(() => {
            clearInterval(progressInterval);
            setAppStatus('loading');
        }, SPLASH_DURATION);

        return () => {
            clearTimeout(splashTimeout);
            clearInterval(progressInterval);
        };
    }
  }, [appStatus]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleAdWatched = async () => {
    if (!userId) return;

    const newPoints = points + AD_REWARD;
    setPoints(newPoints);
    setCooldown(COOLDOWN_SECONDS);
    showToast(`+${AD_REWARD} نقطة!`);
    
    try {
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, { points: newPoints }, { merge: true });
    } catch (error) {
      console.error("Error updating points:", error);
      showToast("فشل تحديث النقاط. حاول مرة أخرى.", true);
      setPoints(points); // Revert points on error
    }
  };

  const triggerAd = () => {
      if (cooldown > 0 || !userId) return;
      
      if (typeof window.show_9854021 === 'function') {
        showToast("جاري تحميل الإعلان...");
        window.show_9854021().then(() => {
            handleAdWatched();
        }).catch(error => {
            console.error("Ad error:", error);
            showToast("فشل عرض الإعلان. حاول لاحقاً.", true);
        });
      } else {
        showToast("فشل تهيئة نظام الإعلانات. يرجى إعادة تحميل التطبيق.", true);
        console.error("Monetag SDK function not found.");
      }
  };


  const handleSpin = async () => {
    if (isSpinning || spinsLeft <= 0 || !userId) return;

    const startSpin = () => {
      setIsSpinning(true);
      setSpinResult(null);
  
      const segments = [500, 100, 400, 200, 300];
      const prize = segments[Math.floor(Math.random() * segments.length)];
      setSpinResult(prize);
  
      const newPoints = points + prize;
      const newSpinsLeft = spinsLeft - 1;
      const today = new Date().toISOString().split('T')[0];
  
      setTimeout(async () => {
          setPoints(newPoints);
          setSpinsLeft(newSpinsLeft);
          showToast(`مبروك! لقد ربحت ${prize} نقطة!`);
          
          try {
              const userDocRef = doc(db, 'users', userId);
              await setDoc(userDocRef, {
                  points: newPoints,
                  spinsLeftToday: newSpinsLeft,
                  lastSpinDate: today,
              }, { merge: true });
          } catch (error) {
              console.error("Error updating points/spins:", error);
              showToast("فشل تحديث البيانات. حاول مرة أخرى.", true);
              // Revert state on error
              setPoints(points);
              setSpinsLeft(spinsLeft);
          }
  
          setIsSpinning(false);
      }, 6500); 
    };

    if (typeof window.show_9854021 === 'function') {
      showToast("شاهد إعلانًا قصيرًا لتلف العجلة...");
      window.show_9854021().then(() => {
          startSpin();
      }).catch(error => {
          console.error("Ad error for spinner:", error);
          showToast("فشل عرض الإعلان. لا يمكنك لف العجلة بدون مشاهدة إعلان.", true);
      });
    } else {
      showToast("فشل تهيئة نظام الإعلانات. يرجى إعادة تحميل التطبيق.", true);
      console.error("Monetag SDK function not found.");
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

    try {
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists() || userDocSnap.data().points < MIN_WITHDRAWAL_POINTS) {
            showToast(`تحتاج إلى ${MIN_WITHDRAWAL_POINTS.toLocaleString()} نقطة على الأقل للسحب.`, true);
            setIsSubmitting(false);
            return;
        }
        
        const currentPointsOnServer = userDocSnap.data().points;

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
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' }),
        });

        const data = await response.json();

        if (data.ok) {
            const newPointsAfterWithdrawal = currentPointsOnServer - MIN_WITHDRAWAL_POINTS;
            await setDoc(userDocRef, { points: newPointsAfterWithdrawal }, { merge: true });
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

  if (appStatus === 'splash') {
    return (
      <div id="splash-screen" className="flex flex-col items-center justify-center min-h-screen bg-background p-8">
        <div className="text-center w-full max-w-sm">
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-6">FlexyEarn</h1>
          <Progress value={progress} className="w-full h-2" />
        </div>
      </div>
    );
  }
  
  if (appStatus === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>جاري تحضير البيانات...</p>
      </div>
    );
  }

  if (appStatus === 'error') {
     return (
       <div className="flex items-center justify-center min-h-screen p-8">
            <div className="card w-full max-w-md shadow-xl flex items-center justify-center p-10 bg-destructive/20">
                <p className="text-destructive font-semibold text-center">{error}</p>
            </div>
       </div>
     )
  }

  return (
    <>
      <button 
        onClick={() => setShowSpinnerDialog(true)}
        className={`fixed bottom-24 right-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all ${spinsLeft > 0 ? 'bg-primary animate-pulse' : 'bg-muted'}`}
        aria-label="عجلة الحظ"
        disabled={spinsLeft <= 0}
      >
        <Gift size={28} />
        {spinsLeft > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-background">
            {spinsLeft}
          </span>
        )}
      </button>

      <div dir="rtl">
        <div id="main-app" className="p-4 flex flex-col items-center min-h-screen pb-24">
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
            
            <div className="card w-full shadow-xl">
              <div className="p-6">
                <h2 className="text-center text-xl font-semibold" style={{ fontWeight: 600 }}>اكسب نقاطك</h2>
              </div>
              <div className="p-6 pt-0 flex flex-col gap-6">
                <div className="text-center p-6 rounded-lg bg-secondary/50">
                  <p className="text-lg text-muted-foreground">شاهد إعلانًا واحصل على</p>
                  <p id="ad-reward-display" className="text-3xl font-bold text-primary">{AD_REWARD} نقطة</p>
                </div>

                <button id="watch-ad-btn" className="btn btn-primary" onClick={triggerAd} disabled={cooldown > 0}>
                  {cooldown > 0 ? `انتظر ${cooldown} ثانية...` : 'مشاهدة إعلان'}
                </button>

                <button id="open-withdrawal-btn" className="btn btn-outline" onClick={() => setShowWithdrawalDialog(true)}>
                  سحب الرصيد
                </button>
              </div>
            </div>
          </main>
        </div>

        {showSpinnerDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="card sm:max-w-md w-full relative">
               <button 
                 onClick={() => !isSpinning && setShowSpinnerDialog(false)} 
                 className="absolute top-2 left-2 text-muted-foreground hover:text-foreground z-10 disabled:opacity-50"
                 disabled={isSpinning}
                 aria-label="إغلاق"
                >
                  <X size={24} />
                </button>
               <div className="flex flex-col space-y-2 text-center p-6 pb-2">
                <h2 className="text-lg font-semibold leading-none tracking-tight" style={{ fontWeight: 600 }}>عجلة الحظ</h2>
                <p className="text-sm text-muted-foreground">لديك {spinsLeft} لفة متبقية. حظ موفق!</p>
              </div>
              <div className="p-6">
               {spinsLeft > 0 ? (
                 <SpinnerWheel onSpin={handleSpin} isSpinning={isSpinning} result={spinResult} />
               ) : (
                <div className='text-center p-8'>
                  <p>لقد استهلكت جميع لفاتك لهذا اليوم. عد غدًا للمزيد!</p>
                </div>
               )}
               </div>
            </div>
          </div>
        )}

        {showWithdrawalDialog && (
          <div id="withdrawal-dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="card sm:max-w-sm w-full">
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
                    <p id="phone-error" className="text-sm font-medium text-red-600 mt-1">
                      {phoneError}
                    </p>
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

        <div 
            id="monetag-banner-container" 
            className="fixed bottom-0 left-0 w-full h-[50px] bg-transparent flex items-center justify-center text-sm text-gray-500 z-30"
        >
           {/* Placeholder for banner ad */}
        </div>
      </div>
    </>
  );
}
