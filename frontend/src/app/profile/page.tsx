 "use client";

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Trophy, Users, UserCircle, Settings, LogOut,
  Mail, Phone, Calendar, Edit3, ArrowLeft, Shield, Save,
  X, Check, Camera, Trash2, ChevronRight, Star, GitBranch, Clock
} from 'lucide-react';

/* ── Shield watermark ── */
function ShieldWM() {
  return (
    <div className="shield-wm">
      <svg viewBox="0 0 200 230" fill="none" style={{ width:"min(68vw,540px)", height:"auto" }}>
        <path d="M100 10L190 50V110C190 160 150 200 100 220C50 200 10 160 10 110V50L100 10Z" fill="#1a2035"/>
        <path d="M100 30L175 64V110C175 152 142 186 100 204C58 186 25 152 25 110V64L100 30Z"
          fill="none" stroke="white" strokeWidth="4" strokeOpacity=".15"/>
        <path d="M82 115L95 128L122 98" stroke="white" strokeWidth="8"
          strokeLinecap="round" strokeLinejoin="round" strokeOpacity=".3"/>
      </svg>
    </div>
  );
}

/* ── Types ── */
type UProfile = {
  firstName: string; lastName: string; email: string;
  phone: string; bio: string; city: string; role: string;
};

const ACTIVITY = [
  { icon:<Trophy size={14}/>,    text:'Зареєструвався на "Весняний хакатон 2026"', time:'2 год тому',  color:'#d97706' },
  { icon:<GitBranch size={14}/>, text:'Здав нову версію: v2_final_build.zip',      time:'5 год тому',  color:'#2d5be3' },
  { icon:<Users size={14}/>,     text:'Додав учасника до Team Alpha',               time:'Вчора 18:42', color:'#16a34a' },
  { icon:<Star size={14}/>,      text:'Отримав досягнення "Перша перемога"',        time:'3 дні тому',  color:'#8b5cf6' },
  { icon:<Trophy size={14}/>,    text:'Завершив турнір "Winter Dev Cup"',           time:'5 днів тому', color:'#d97706' },
];

/* ── Sidebar ── */
function Sidebar({ avatar, name, initials, onBack }: {
  avatar: string | null; name: string; initials: string; onBack: () => void;
}) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  return (
    <aside className="sidebar sl">
      <div style={{ padding:"18px 14px", borderBottom:"1px solid var(--brd)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:11, padding:"8px 10px", borderRadius:13 }}>
          <div style={{
            width:36, height:36, borderRadius:"50%", overflow:"hidden", flexShrink:0,
            background:"linear-gradient(135deg,var(--accent),#6b8ff7)",
            display:"flex", alignItems:"center", justifyContent:"center",
            color:"#fff", fontWeight:900, fontSize:13,
            boxShadow:"0 3px 10px rgba(45,91,227,.3)",
          }}>
            {avatar ? <img src={avatar} alt="av" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : initials}
          </div>
          <div style={{ overflow:"hidden", flex:1 }}>
            <p style={{ fontSize:13, fontWeight:800, color:"var(--t1)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{name}</p>
            <p style={{ fontSize:10, color:"var(--accent)", textTransform:"uppercase", letterSpacing:".07em", fontWeight:700 }}>Профіль</p>
          </div>
        </div>
      </div>

      <nav style={{ flex:1, padding:"10px", display:"flex", flexDirection:"column", gap:2 }}>
        {[
          { icon:<LayoutDashboard size={17}/>, label:"Dashboard" },
          { icon:<Trophy size={17}/>,          label:"Турніри" },
          { icon:<Users size={17}/>,           label:"Команди" },
          { icon:<UserCircle size={17}/>,      label:"Гравці", active:true },
          { icon:<Settings size={17}/>,        label:"Налаштування" },
        ].map((item, i) => (
          <button key={item.label}
            className={`nav-item sl d${(i+1)*50} ${item.active ? "active" : ""}`}>
            {item.icon}<span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div style={{ padding:"10px", borderTop:"1px solid var(--brd)" }} className="fi d400">
        <button className="nav-item spr" style={{ color:"var(--t3)" }}
          onClick={handleLogout}
          onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--t3)")}
        >
          <LogOut size={17}/><span>Вихід</span>
        </button>
      </div>
    </aside>
  );
}

/* ════ PROFILE PAGE ════ */
export default function ProfilePage() {
  const router = useRouter();

  const [editing, setEditing]     = useState(false);
  const [saved, setSaved]         = useState(false);
  const [avatar, setAvatar]       = useState<string | null>(null);
  const [avatarErr, setAvatarErr] = useState('');
  const [tab, setTab]             = useState<'info' | 'activity' | 'stats'>('info');
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UProfile>({
    firstName:'Anton', lastName:'Petrov',
    email:'anton.petrov@example.com', phone:'+380 99 123 4567',
    bio:'Адміністратор платформи. Відповідає за організацію турнірів та управління командами.',
    city:'Київ, Україна', role:'Admin',
  });
  const [draft, setDraft] = useState({ ...profile });
  const initials = `${profile.firstName[0]??''}${profile.lastName[0]??''}`.toUpperCase();

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setAvatarErr('Оберіть зображення'); return; }
    if (f.size > 5e6) { setAvatarErr('Максимум 5 МБ'); return; }
    setAvatarErr('');
    const r = new FileReader();
    r.onload = () => setAvatar(r.result as string);
    r.readAsDataURL(f);
    // TODO: await fetch('/api/profile/avatar', { method:'POST', body: formData })
  };

  const onSave = () => {
    // TODO: await fetch('/api/profile', { method:'PATCH', body: JSON.stringify(draft) })
    setProfile({ ...draft }); setEditing(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  /* ── → Main page ── */
  const goBack = () => router.push('/main_page');

  const stats = [
    { label:'Турніри',  val:'12',  color:'var(--accent)', sub:'+3 цього місяця' },
    { label:'Команди',  val:'34',  color:'#22c55e',       sub:'Активних: 5' },
    { label:'Гравці',   val:'128', color:'#f59e0b',       sub:'У 8 командах' },
    { label:'Перемоги', val:'8',   color:'#8b5cf6',       sub:'Win rate 67%' },
  ];

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)', position:'relative', overflow:'hidden' }}>
      <ShieldWM />
      <Sidebar avatar={avatar} name={`${profile.firstName} ${profile.lastName}`} initials={initials} onBack={goBack} />

      <main style={{ flex:1, padding:'32px 40px', overflowY:'auto', position:'relative', zIndex:1 }}>

        {/* Breadcrumb */}
        <header className="fu" style={{ marginBottom:28 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:11, color:'var(--t3)', marginBottom:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em' }}>
            {/* ── → Main page ── */}
            <button onClick={goBack} className="spr"
              style={{ background:'none', border:'none', cursor:'pointer', color:'inherit', display:'flex', alignItems:'center', gap:4, padding:0, fontSize:'inherit', fontWeight:'inherit', letterSpacing:'inherit', textTransform:'inherit', transition:'color 150ms ease' }}
              onMouseEnter={e => (e.currentTarget.style.color='var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.color='var(--t3)')}
            >
              <ArrowLeft size={11}/> Головна
            </button>
            <ChevronRight size={11}/>
            <span style={{ color:'var(--t2)' }}>Профіль</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
            <h1 style={{ fontFamily:'var(--font)', fontSize:24, fontWeight:900, color:'var(--t1)', textTransform:'uppercase', letterSpacing:'-.02em' }}>
              Профіль користувача
            </h1>
            {saved && (
              <span className="badge b-ok" style={{ fontSize:12, padding:'6px 16px', gap:6, animation:'saveFlash 400ms var(--spring) both' }}>
                <Check size={13}/> Збережено
              </span>
            )}
          </div>
        </header>

        <div style={{ maxWidth:900, display:'flex', flexDirection:'column', gap:22 }}>

          {/* ══ HERO CARD ══ */}
          <div className="fu d50 cl" style={{ background:'var(--card)', borderRadius:22, boxShadow:'var(--sh-md)', border:'1px solid var(--brd)', overflow:'hidden' }}>
            <div style={{ height:5, background:'linear-gradient(90deg,var(--accent),#6b8ff7,#a78bfa)' }}/>
            <div style={{ padding:'28px', display:'flex', alignItems:'flex-start', gap:24, flexWrap:'wrap' }}>

              {/* Avatar */}
              <div className="av" style={{ position:'relative', flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <div style={{
                  width:96, height:96, borderRadius:22, position:'relative',
                  background:'linear-gradient(135deg,var(--accent) 0%,#6b8ff7 50%,#a78bfa 100%)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:30, fontWeight:900, color:'#fff',
                  overflow:'hidden', cursor:'pointer',
                  boxShadow:'0 8px 28px rgba(45,91,227,.3)',
                  transition:'transform 200ms var(--spring),box-shadow 200ms ease',
                }}
                  onClick={() => fileRef.current?.click()}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform='scale(1.06)';
                    e.currentTarget.style.boxShadow='0 12px 36px rgba(45,91,227,.4)';
                    const ov=e.currentTarget.querySelector<HTMLElement>('.av-ov');
                    if(ov) ov.style.opacity='1';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform='scale(1)';
                    e.currentTarget.style.boxShadow='0 8px 28px rgba(45,91,227,.3)';
                    const ov=e.currentTarget.querySelector<HTMLElement>('.av-ov');
                    if(ov) ov.style.opacity='0';
                  }}
                >
                  {avatar ? <img src={avatar} alt="av" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : initials}
                  <div className="av-ov" style={{ position:'absolute', inset:0, borderRadius:22, background:'rgba(0,0,0,.5)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, opacity:0, transition:'opacity 160ms ease' }}>
                    <Camera size={20} color="#fff"/>
                    <span style={{ fontSize:9, color:'#fff', fontWeight:900, textTransform:'uppercase', letterSpacing:'.08em' }}>Змінити</span>
                  </div>
                </div>

                {avatar && (
                  <button className="pop spr"
                    onClick={() => { setAvatar(null); if(fileRef.current) fileRef.current.value=''; }}
                    style={{ position:'absolute', top:-6, right:-6, width:24, height:24, borderRadius:'50%', background:'#ef4444', border:'2px solid var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                    <Trash2 size={12} color="#fff"/>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={onAvatarChange}/>
                <p style={{ fontSize:10, color:'var(--t3)', fontWeight:600, textAlign:'center' }}>Клікни для<br/>зміни</p>
              </div>

              {/* Info */}
              <div className="fu d150" style={{ flex:1, minWidth:200 }}>
                <h2 style={{ fontFamily:'var(--font)', fontSize:24, fontWeight:900, color:'var(--t1)', textTransform:'uppercase', letterSpacing:'-.02em', marginBottom:10 }}>
                  {profile.firstName} {profile.lastName}
                </h2>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                  <span className="badge b-adm bp d250"><Shield size={9}/> {profile.role}</span>
                  <span className="badge b-ok  bp d300">Активний</span>
                  <span className="badge b-warn bp d350"><Star size={9}/> Top Contributor</span>
                </div>
                <p style={{ fontSize:13, color:'var(--t2)', lineHeight:1.65, maxWidth:420, marginBottom:12 }}>{profile.bio}</p>
                <div style={{ display:'flex', gap:18, flexWrap:'wrap' }}>
                  <span style={{ fontSize:12, color:'var(--t3)', fontWeight:600 }}>📍 {profile.city}</span>
                  <span style={{ fontSize:12, color:'var(--t3)', fontWeight:600 }}>📅 З 15.01.2025</span>
                </div>
                {avatarErr && <p style={{ fontSize:11, color:'#ef4444', marginTop:8, fontWeight:600 }}>{avatarErr}</p>}
              </div>

              {!editing && (
                <button className="btn-g spr fi d300"
                  onClick={() => { setDraft({...profile}); setEditing(true); }}
                  style={{ padding:'10px 20px', display:'flex', alignItems:'center', gap:7, flexShrink:0 }}>
                  <Edit3 size={14}/> Редагувати
                </button>
              )}
            </div>
          </div>

          {/* ══ STATS ══ */}
          <div className="fu d200" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
            {stats.map((s,i) => (
              <div key={s.label} className="pop cl"
                style={{ background:'var(--card)', borderRadius:18, boxShadow:'var(--sh-sm)', border:'1px solid var(--brd)', padding:'20px 18px', position:'relative', overflow:'hidden', animationDelay:`${200+i*70}ms` }}>
                <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:s.color, borderRadius:'99px 0 0 99px' }}/>
                <p className="cnt" style={{ fontFamily:'var(--font)', fontSize:32, fontWeight:900, color:s.color, lineHeight:1, animationDelay:`${300+i*70}ms` }}>{s.val}</p>
                <p style={{ fontSize:10, fontWeight:800, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.08em', marginTop:4 }}>{s.label}</p>
                <p style={{ fontSize:11, color:'var(--t3)', marginTop:4, fontStyle:'italic' }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* ══ TABS ══ */}
          <div className="fu d300" style={{ background:'var(--card)', borderRadius:22, boxShadow:'var(--sh-md)', border:'1px solid var(--brd)', overflow:'hidden' }}>

            {/* Tab bar */}
            <div style={{ display:'flex', borderBottom:'1px solid var(--brd)', padding:'0 24px' }}>
              {([
                { id:'info',     label:'Інформація' },
                { id:'activity', label:'Активність' },
                { id:'stats',    label:'Статистика' },
              ] as {id:'info'|'activity'|'stats'; label:string}[]).map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  padding:'14px 18px', fontFamily:'var(--font)', fontSize:13, fontWeight:800,
                  color: tab===t.id ? 'var(--accent)' : 'var(--t3)',
                  background:'none', border:'none', cursor:'pointer',
                  textTransform:'uppercase', letterSpacing:'.05em',
                  transition:'color 150ms ease',
                  borderBottom: tab===t.id ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom:-1,
                }}>{t.label}</button>
              ))}
            </div>

            {/* Tab: INFO */}
            {tab==='info' && (
              <div className="tsld" style={{ padding:'24px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                  <h3 style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:14, color:'var(--t1)', textTransform:'uppercase', display:'flex', alignItems:'center', gap:8 }}>
                    <UserCircle size={16} color="var(--accent)"/>
                    {editing ? 'Редагування профілю' : 'Контактна інформація'}
                  </h3>
                  {editing && (
                    <div className="fu" style={{ display:'flex', gap:8 }}>
                      <button className="btn-g spr" onClick={() => setEditing(false)}
                        style={{ padding:'7px 14px', display:'flex', alignItems:'center', gap:6 }}>
                        <X size={13}/> Скасувати
                      </button>
                      <button className="btn-p spr" onClick={onSave}
                        style={{ padding:'7px 16px', display:'flex', alignItems:'center', gap:6 }}>
                        <Save size={13}/> Зберегти
                      </button>
                    </div>
                  )}
                </div>

                {editing ? (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:13 }}>
                    {([ ['firstName',"Ім'я"], ['lastName','Прізвище'], ['email','Email'], ['phone','Телефон'], ['city','Місто'], ['role','Роль'] ] as [keyof UProfile,string][]).map(([k,l],i) => (
                      <div key={k} className="fu" style={{ display:'flex', flexDirection:'column', gap:5, animationDelay:`${i*40}ms` }}>
                        <label style={{ fontSize:10, fontWeight:800, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.08em' }}>{l}</label>
                        <input className="inp" value={draft[k]} onChange={e => setDraft(p=>({...p,[k]:e.target.value}))}/>
                      </div>
                    ))}
                    <div className="fu" style={{ gridColumn:'1/-1', display:'flex', flexDirection:'column', gap:5, animationDelay:'240ms' }}>
                      <label style={{ fontSize:10, fontWeight:800, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.08em' }}>Про себе</label>
                      <textarea className="inp" rows={3} value={draft.bio} onChange={e => setDraft(p=>({...p,bio:e.target.value}))} style={{ resize:'none' }}/>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    {[
                      { icon:<Mail size={15}/>,      label:'Email',      val:profile.email, d:0   },
                      { icon:<Phone size={15}/>,     label:'Телефон',    val:profile.phone, d:60  },
                      { icon:<Calendar size={15}/>,  label:'Реєстрація', val:'15.01.2025',  d:120 },
                      { icon:<Trophy size={15}/>,    label:'Роль',       val:profile.role,  d:180 },
                      { icon:<UserCircle size={15}/>,label:'Місто',      val:profile.city,  d:240 },
                      { icon:<Star size={15}/>,      label:'Статус',     val:'Активний',    d:300 },
                    ].map(f => (
                      <div key={f.label} className="su"
                        style={{ background:'var(--bg)', borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'center', gap:12, border:'1px solid var(--brd)', animationDelay:`${f.d}ms`, transition:'border-color 150ms ease,background 150ms ease' }}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(45,91,227,.3)';e.currentTarget.style.background='#fff';}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--brd)';e.currentTarget.style.background='var(--bg)';}}>
                        <div style={{ color:'var(--accent)', flexShrink:0 }}>{f.icon}</div>
                        <div>
                          <p style={{ fontSize:10, fontWeight:800, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.08em' }}>{f.label}</p>
                          <p style={{ fontSize:13, fontWeight:600, color:'var(--t1)' }}>{f.val}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: ACTIVITY */}
            {tab==='activity' && (
              <div className="tsld" style={{ padding:'20px 24px' }}>
                <h3 style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:13, color:'var(--t1)', textTransform:'uppercase', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                  <Clock size={15} color="var(--accent)"/> Остання активність
                </h3>
                {ACTIVITY.map((item,i) => (
                  <div key={i} className="act-item fu"
                    style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 10px', borderRadius:12, animationDelay:`${i*60}ms`, borderBottom:i<ACTIVITY.length-1?'1px solid var(--brd)':'none' }}>
                    <div style={{ width:34, height:34, borderRadius:10, flexShrink:0, background:`${item.color}18`, border:`1px solid ${item.color}35`, display:'flex', alignItems:'center', justifyContent:'center', color:item.color }}>
                      {item.icon}
                    </div>
                    <p style={{ flex:1, fontSize:13, fontWeight:600, color:'var(--t1)', lineHeight:1.4 }}>{item.text}</p>
                    <p style={{ fontSize:11, color:'var(--t3)', whiteSpace:'nowrap', fontWeight:600, fontStyle:'italic' }}>{item.time}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Tab: STATS */}
            {tab==='stats' && (
              <div className="tsld" style={{ padding:'24px' }}>
                <h3 style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:13, color:'var(--t1)', textTransform:'uppercase', marginBottom:18, display:'flex', alignItems:'center', gap:8 }}>
                  <Star size={15} color="var(--accent)"/> Детальна статистика
                </h3>
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  {[
                    { label:'Win Rate',       val:67, color:'var(--accent)', suf:'%' },
                    { label:'Здано завдань',   val:89, color:'#22c55e',      suf:'%' },
                    { label:'Активність',      val:78, color:'#f59e0b',      suf:'%' },
                    { label:'Командна робота', val:92, color:'#8b5cf6',      suf:'%' },
                  ].map((bar,i) => (
                    <div key={bar.label} className="fu" style={{ animationDelay:`${i*80}ms` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                        <span style={{ fontSize:12, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.06em' }}>{bar.label}</span>
                        <span style={{ fontSize:14, fontWeight:900, color:bar.color }}>{bar.val}{bar.suf}</span>
                      </div>
                      <div style={{ height:8, background:'var(--bg2)', borderRadius:99, overflow:'hidden' }}>
                        <div style={{
                          height:'100%', borderRadius:99, background:bar.color,
                          width:`${bar.val}%`,
                          animation:`lineGrow 600ms var(--spring) ${200+i*100}ms both`,
                          boxShadow:`0 2px 8px ${bar.color}55`,
                        }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}