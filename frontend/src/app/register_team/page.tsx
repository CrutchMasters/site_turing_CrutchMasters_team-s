"use client";

import React, { useState } from 'react';
import {
  LayoutDashboard, Trophy, Users, User, Settings, LogOut,
  AlertCircle, Plus, Trash2, CheckCircle, ChevronRight
} from 'lucide-react';

const DS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap');
  :root {
    --font:'Barlow',sans-serif;
    --bg:#ebebee;--bg2:#e4e4e8;--white:#fff;--card:#fff;
    --t1:#1a2035;--t2:#5a6278;--t3:#9aa0b0;
    --accent:#2d5be3;--accent-h:#1e47cc;--accent-s:rgba(45,91,227,.1);
    --brd:rgba(0,0,0,.07);--brd2:rgba(0,0,0,.12);
    --sh-sm:0 2px 8px rgba(0,0,0,.06);
    --sh-md:0 6px 24px rgba(0,0,0,.09);
    --sh-lg:0 12px 40px rgba(0,0,0,.12);
    --spring:cubic-bezier(.22,1,.36,1);
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:var(--font);background:var(--bg);color:var(--t1);}

  @keyframes fadeUp    {from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
  @keyframes fadeIn    {from{opacity:0}to{opacity:1}}
  @keyframes slideLeft {from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}
  @keyframes scaleUp   {from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
  @keyframes popBounce {0%{opacity:0;transform:scale(.65)}65%{transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
  @keyframes rowIn     {from{opacity:0;transform:translateX(-8px) scale(.99)}to{opacity:1;transform:none}}
  @keyframes shieldFloat{0%,100%{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(-12px) rotate(-5deg)}}
  @keyframes shake     {0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
  @keyframes successPop{0%{opacity:0;transform:scale(.7) translateY(20px)}70%{transform:scale(1.04) translateY(0)}100%{opacity:1;transform:none}}

  .fu  {animation:fadeUp    320ms var(--spring) both}
  .fi  {animation:fadeIn    250ms ease both}
  .sl  {animation:slideLeft 300ms var(--spring) both}
  .su  {animation:scaleUp   270ms var(--spring) both}
  .pop {animation:popBounce 400ms var(--spring) both}
  .row {animation:rowIn     280ms var(--spring) both}
  .shake{animation:shake 360ms var(--spring)}
  .success-enter{animation:successPop 500ms var(--spring) both}

  .d50 {animation-delay:50ms}  .d100{animation-delay:100ms} .d150{animation-delay:150ms}
  .d200{animation-delay:200ms} .d250{animation-delay:250ms} .d300{animation-delay:300ms}
  .d350{animation-delay:350ms} .d400{animation-delay:400ms}

  .spr{transition:transform 170ms var(--spring),box-shadow 170ms ease;}
  .spr:hover{transform:translateY(-2px) scale(1.025);}
  .spr:active{transform:scale(.96);}

  .cl{transition:transform 220ms var(--spring),box-shadow 220ms ease;}
  .cl:hover{transform:translateY(-3px);box-shadow:var(--sh-lg);}

  .inp{
    width:100%;padding:11px 14px;
    background:var(--bg);border:1.5px solid transparent;
    border-radius:11px;color:var(--t1);
    font-family:var(--font);font-size:.875rem;outline:none;
    transition:border-color 150ms ease,background 150ms ease,
               box-shadow 150ms ease,transform 150ms var(--spring);
  }
  .inp::placeholder{color:var(--t3);font-style:italic;}
  .inp:focus{border-color:var(--accent);background:var(--white);box-shadow:0 0 0 3px var(--accent-s);transform:scale(1.003);}
  .inp.ok{border-color:#22c55e;}

  .btn-p{
    background:var(--accent);color:#fff;
    font-family:var(--font);font-weight:800;font-size:13px;
    letter-spacing:.05em;text-transform:uppercase;
    border:none;border-radius:999px;cursor:pointer;
    transition:background 150ms ease,transform 170ms var(--spring),box-shadow 170ms ease;
  }
  .btn-p:hover{background:var(--accent-h);transform:translateY(-2px);box-shadow:0 6px 20px rgba(45,91,227,.3);}
  .btn-p:active{transform:scale(.96);}
  .btn-p:disabled{background:#c8cdd8;color:#9aa0b0;cursor:not-allowed;transform:none;box-shadow:none;}

  .btn-g{
    background:var(--white);color:var(--t2);
    font-family:var(--font);font-weight:700;font-size:12px;
    border:1.5px solid var(--brd2);border-radius:999px;cursor:pointer;
    transition:background 150ms ease,color 150ms ease,border-color 150ms ease,transform 170ms var(--spring);
  }
  .btn-g:hover{background:var(--bg);color:var(--t1);border-color:var(--accent);transform:translateY(-1px);}

  .sidebar{width:228px;background:var(--white);border-right:1px solid var(--brd);display:flex;flex-direction:column;flex-shrink:0;box-shadow:var(--sh-sm);}
  .nav-item{
    display:flex;align-items:center;gap:11px;padding:10px 13px;
    border-radius:12px;font-size:.875rem;font-weight:600;color:var(--t2);
    cursor:pointer;width:100%;border:none;background:none;
    transition:background 150ms ease,color 150ms ease,transform 150ms var(--spring);
  }
  .nav-item:hover{background:var(--bg);color:var(--t1);transform:translateX(3px);}
  .nav-item.active{background:var(--accent-s);color:var(--accent);}

  ::-webkit-scrollbar{width:5px;}
  ::-webkit-scrollbar-thumb{background:var(--brd2);border-radius:99px;}
`;

function Shield() {
  return (
    <svg viewBox="0 0 200 230" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'auto' }}>
      <path d="M100 10L190 50V110C190 160 150 200 100 220C50 200 10 160 10 110V50L100 10Z" fill="#1a2035"/>
      <path d="M100 30L175 64V110C175 152 142 186 100 204C58 186 25 152 25 110V64L100 30Z" fill="none" stroke="white" strokeWidth="4" strokeOpacity=".15"/>
      <path d="M82 115L95 128L122 98" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" strokeOpacity=".3"/>
    </svg>
  );
}

type Participant = { id:number; name:string; email:string };

export default function TeamRegistration() {
  const [parts, setParts] = useState<Participant[]>([
    { id:1, name:'', email:'' },
    { id:2, name:'', email:'' },
  ]);
  const [teamName, setTeamName]     = useState('');
  const [captainName, setCaptain]   = useState('');
  const [captainEmail, setCaptainEmail] = useState('');
  const [submitted, setSubmitted]   = useState(false);
  const [shakeErr, setShakeErr]     = useState(false);

  const addPart    = () => { if (parts.length < 10) setParts(p => [...p, { id:Date.now(), name:'', email:'' }]); };
  const removePart = (id:number) => { if (parts.length > 2) setParts(p => p.filter(x => x.id !== id)); };
  const updatePart = (id:number, field:keyof Participant, val:string) =>
    setParts(p => p.map(x => x.id === id ? { ...x,[field]:val } : x));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parts.length < 2) { setShakeErr(true); setTimeout(() => setShakeErr(false), 500); return; }
    setSubmitted(true);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DS }} />
      <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)', position:'relative', overflow:'hidden' }}>

        {/* Shield watermark */}
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', zIndex:0, opacity:.07, animation:'shieldFloat 6s ease-in-out infinite' }}>
          <div style={{ width:'min(70vw,580px)' }}><Shield /></div>
        </div>

        {/* Sidebar */}
        <aside className="sidebar sl">
          <div style={{ padding:'18px 16px', borderBottom:'1px solid var(--brd)' }}>
            <div className="pop" style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,var(--accent),#6b8ff7)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 3px 10px rgba(45,91,227,.3)' }}>
              <Trophy size={17} color="#fff"/>
            </div>
          </div>
          <nav style={{ flex:1, padding:'10px 10px', display:'flex', flexDirection:'column', gap:2 }}>
            {[
              { icon:<LayoutDashboard size={17}/>, label:'Dashboard' },
              { icon:<Trophy size={17}/>, label:'Турніри', active:true },
              { icon:<Users size={17}/>, label:'Команди' },
              { icon:<User size={17}/>, label:'Гравці' },
              { icon:<Settings size={17}/>, label:'Налаштування' },
            ].map((item, i) => (
              <button key={item.label} className={`nav-item sl d${(i+1)*50} ${item.active?'active':''}`}>
                {item.icon}<span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div style={{ padding:'10px 10px', borderTop:'1px solid var(--brd)' }} className="fi d400">
            <button className="nav-item spr" style={{ color:'var(--t3)' }}
              onMouseEnter={e => (e.currentTarget.style.color='#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color='var(--t3)')}
            ><LogOut size={17}/><span>Logout</span></button>
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex:1, padding:'32px 36px', overflowY:'auto', position:'relative', zIndex:1 }}>
          <header className="fu" style={{ marginBottom:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:11, color:'var(--t3)', marginBottom:6, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em' }}>
              <span>Турніри</span><ChevronRight size={11}/><span style={{ color:'var(--t2)' }}>Реєстрація команди</span>
            </div>
            <h1 style={{ fontFamily:'var(--font)', fontSize:22, fontWeight:900, color:'var(--t1)', textTransform:'uppercase', letterSpacing:'-.02em' }}>
              Реєстрація команди
            </h1>
          </header>

          {submitted ? (
            /* Success screen */
            <div className="success-enter" style={{ background:'var(--card)', borderRadius:20, boxShadow:'var(--sh-md)', border:'1px solid var(--brd)', padding:52, textAlign:'center', maxWidth:440 }}>
              <div className="pop" style={{ width:68, height:68, borderRadius:18, margin:'0 auto 20px', background:'rgba(34,197,94,.1)', border:'1px solid rgba(34,197,94,.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <CheckCircle size={34} color="#16a34a"/>
              </div>
              <h2 style={{ fontFamily:'var(--font)', fontSize:22, fontWeight:900, color:'var(--t1)', textTransform:'uppercase', marginBottom:8 }}>Команду зареєстровано!</h2>
              <p style={{ fontSize:13, color:'var(--t2)' }}>Вашу команду успішно подано на турнір.</p>
            </div>
          ) : (
            <div style={{ maxWidth:700 }}>
              {/* Info banner */}
              <div className="fu d50" style={{ background:'rgba(45,91,227,.07)', border:'1px solid rgba(45,91,227,.18)', borderRadius:14, padding:'14px 18px', marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
                <AlertCircle size={16} color="var(--accent)" style={{ flexShrink:0 }}/>
                <p style={{ fontSize:13, color:'var(--t2)' }}>
                  Реєстрація на турнір <span style={{ color:'var(--t1)', fontWeight:800 }}>[Назва Турніру]</span> доступна до: DD.MM.YYYY HH:MM
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:18 }}>

                {/* Section 1 */}
                <div className="fu d100 cl" style={{ background:'var(--card)', borderRadius:18, boxShadow:'var(--sh-md)', border:'1px solid var(--brd)', overflow:'hidden' }}>
                  <SectionHeader dot="var(--accent)" title="Загальна інформація" />
                  <div style={{ padding:'20px 22px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <Field label="Назва команди" placeholder="Введіть назву" value={teamName} onChange={setTeamName} delay={150}/>
                    <Field label="Місто / Школа" placeholder="Напр. Київ, СШ №100" delay={200}/>
                    <Field label="Організація (опціонально)" placeholder="IT-Club" delay={250}/>
                    <Field label="Telegram / Discord" placeholder="@username" delay={300}/>
                  </div>
                </div>

                {/* Section 2 */}
                <div className="fu d150 cl" style={{ background:'var(--card)', borderRadius:18, boxShadow:'var(--sh-md)', border:'1px solid var(--brd)', overflow:'hidden' }}>
                  <SectionHeader dot="#8b5cf6" title="Капітан" />
                  <div style={{ padding:'20px 22px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <Field label="ПІБ капітана" placeholder="Іванов Іван Іванович" value={captainName} onChange={setCaptain} delay={200}/>
                    <Field label="Email капітана" placeholder="captain@example.com" type="email" value={captainEmail} onChange={setCaptainEmail} showCheck delay={250}/>
                  </div>
                </div>

                {/* Section 3 */}
                <div className="fu d200 cl" style={{ background:'var(--card)', borderRadius:18, boxShadow:'var(--sh-md)', border:'1px solid var(--brd)', overflow:'hidden' }}>
                  <div style={{ padding:'14px 22px', borderBottom:'1px solid var(--brd)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 7px rgba(34,197,94,.5)' }}/>
                      <h3 style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:13, color:'var(--t1)', textTransform:'uppercase', letterSpacing:'-.01em' }}>Учасники</h3>
                      <span style={{
                        fontSize:10, fontWeight:800, padding:'2px 9px', borderRadius:99,
                        background: parts.length < 2 ? 'rgba(239,68,68,.1)' : 'rgba(34,197,94,.1)',
                        color: parts.length < 2 ? '#dc2626' : '#16a34a',
                        border: `1px solid ${parts.length < 2 ? 'rgba(239,68,68,.25)' : 'rgba(34,197,94,.25)'}`,
                        transition:'all 200ms ease',
                      }}>
                        {parts.length} / 10
                      </span>
                    </div>
                    {parts.length < 10 && (
                      <button type="button" className="btn-g spr" onClick={addPart}
                        style={{ padding:'6px 14px', display:'flex', alignItems:'center', gap:6 }}>
                        <Plus size={13}/> Додати
                      </button>
                    )}
                  </div>
                  <div style={{ padding:'16px 22px', display:'flex', flexDirection:'column', gap:10 }}>
                    {parts.map((p, idx) => (
                      <div key={p.id} className="row" style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:10, alignItems:'end', animationDelay:`${idx*55}ms` }}>
                        <Field label={`Учасник ${idx+1} (ПІБ)`} placeholder="Прізвище Ім'я" value={p.name} onChange={v => updatePart(p.id,'name',v)}/>
                        <Field label={`Email ${idx+1}`} placeholder="user@example.com" type="email" value={p.email} onChange={v => updatePart(p.id,'email',v)} showCheck/>
                        <button type="button" onClick={() => removePart(p.id)} disabled={parts.length <= 2}
                          style={{
                            width:37, height:37, borderRadius:10,
                            background:'rgba(239,68,68,.07)', border:'1px solid rgba(239,68,68,.15)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            cursor: parts.length <= 2 ? 'not-allowed' : 'pointer',
                            color: parts.length <= 2 ? 'var(--t3)' : '#ef4444',
                            opacity: parts.length <= 2 ? .35 : 1,
                            transition:'all 150ms ease', flexShrink:0,
                          }}
                          onMouseEnter={e => { if(parts.length>2){ e.currentTarget.style.background='rgba(239,68,68,.15)'; e.currentTarget.style.transform='scale(1.08)'; }}}
                          onMouseLeave={e => { e.currentTarget.style.background='rgba(239,68,68,.07)'; e.currentTarget.style.transform='scale(1)'; }}
                        >
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Error */}
                {parts.length < 2 && (
                  <div className={`fu ${shakeErr ? 'shake' : ''}`} style={{ background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.2)', borderRadius:12, padding:'11px 16px', display:'flex', alignItems:'center', gap:9, fontSize:13, color:'#dc2626', fontWeight:700 }}>
                    <AlertCircle size={16} style={{ flexShrink:0 }}/> Мінімум 2 учасники для реєстрації
                  </div>
                )}

                {/* Buttons */}
                <div className="fu d350" style={{ display:'flex', gap:12 }}>
                  <button type="submit" className="btn-p spr" style={{ padding:'13px 26px', display:'flex', alignItems:'center', gap:8 }}>
                    <Trophy size={15}/> Створити команду
                  </button>
                  <button type="button" className="btn-g spr" style={{ padding:'13px 20px' }}>
                    Скасувати
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

function SectionHeader({ dot, title }: { dot:string; title:string }) {
  return (
    <div style={{ padding:'14px 22px', borderBottom:'1px solid var(--brd)', display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ width:7, height:7, borderRadius:'50%', background:dot, boxShadow:`0 0 7px ${dot}88` }}/>
      <h3 style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:13, color:'var(--t1)', textTransform:'uppercase', letterSpacing:'-.01em' }}>{title}</h3>
    </div>
  );
}

function Field({ label, placeholder, value='', onChange, type='text', showCheck=false, delay=0 }: {
  label:string; placeholder:string; value?:string;
  onChange?:(v:string)=>void; type?:string;
  showCheck?:boolean; delay?:number;
}) {
  const hasVal = value.trim().length > 0;
  return (
    <div className="fu" style={{ display:'flex', flexDirection:'column', gap:5, animationDelay:`${delay}ms` }}>
      <label style={{ fontSize:10, fontWeight:800, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.08em' }}>{label}</label>
      <div style={{ position:'relative' }}>
        <input type={type} className={`inp ${showCheck&&hasVal?'ok':''}`}
          placeholder={placeholder} value={value}
          onChange={e => onChange?.(e.target.value)}
          style={{ paddingRight: showCheck ? 34 : undefined }}
        />
        {showCheck && hasVal && (
          <div className="pop" style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'#22c55e' }}>
            <CheckCircle size={15}/>
          </div>
        )}
      </div>
    </div>
  );
}