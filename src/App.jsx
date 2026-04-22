import React,{useCallback,useEffect,useRef,useState}from'react';

// ─────────────────────────────────────────────────────────────────────────────
// CESIRA V2 — Autonomous Electronic Music Workstation
// Full-screen, self-composing, live-performable, export-ready
// ─────────────────────────────────────────────────────────────────────────────

const MAX_STEPS=64,PAGE=16,SCHED=0.14,LOOK=20,UNDO=32;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const rnd=()=>Math.random();
const pick=a=>a[Math.floor(rnd()*a.length)];
const lerp=(a,b,t)=>a+(b-a)*t;

const SOUND_CHARACTERS={
  warm:{toneBias:0.12,spaceBias:0.08,driveBias:-0.03,noiseBias:-0.02,bassFilterBias:-0.04,synthFilterBias:-0.02,accentBias:0.02,motionBias:0.06,humanizeBias:0.05},
  dark:{toneBias:-0.16,spaceBias:0.02,driveBias:0.05,noiseBias:0.04,bassFilterBias:-0.08,synthFilterBias:-0.1,accentBias:0.03,motionBias:0.04,humanizeBias:0.02},
  bright:{toneBias:0.16,spaceBias:0.0,driveBias:-0.01,noiseBias:0.03,bassFilterBias:0.04,synthFilterBias:0.12,accentBias:0.01,motionBias:0.08,humanizeBias:0.04},
  dirty:{toneBias:-0.08,spaceBias:-0.02,driveBias:0.12,noiseBias:0.08,bassFilterBias:-0.02,synthFilterBias:-0.06,accentBias:0.05,motionBias:0.1,humanizeBias:0.06},
  tight:{toneBias:0.02,spaceBias:-0.04,driveBias:0.02,noiseBias:-0.01,bassFilterBias:0.06,synthFilterBias:0.04,accentBias:0.06,motionBias:-0.02,humanizeBias:-0.02},
};
const CHARACTER_BY_GENRE={dnb:'dirty',acid:'dirty',industrial:'dark',experimental:'bright',cinematic:'warm'};
const getGenreSoundCharacter=genre=>CHARACTER_BY_GENRE[genre]||pick(Object.keys(SOUND_CHARACTERS));

const GENRE_FAMILY_PROFILES={
  dnb:{drive:0.18,tone:0.08,space:-0.01,motion:0.1,accent:0.08,hookBias:0.78,fillBias:'break',bassRole:'pressure',synthRole:'stab'},
  acid:{drive:0.2,tone:0.02,space:-0.02,motion:0.12,accent:0.07,hookBias:0.82,fillBias:'squelch',bassRole:'lead',synthRole:'answer'},
  industrial:{drive:0.28,tone:-0.14,space:-0.06,motion:0.08,accent:0.1,hookBias:0.58,fillBias:'impact',bassRole:'weight',synthRole:'shard'},
  experimental:{drive:0.12,tone:0.12,space:0.12,motion:0.18,accent:0.04,hookBias:0.52,fillBias:'glitch',bassRole:'shape',synthRole:'gesture'},
  cinematic:{drive:-0.04,tone:-0.08,space:0.2,motion:0.04,accent:0.01,hookBias:0.56,fillBias:'swell',bassRole:'pedal',synthRole:'theme'},
};
const getGenreFamilyProfile=genre=>GENRE_FAMILY_PROFILES[genre]||GENRE_FAMILY_PROFILES.acid;


const SOUND_FAMILY_PROFILES={
  drums:{
    pressure:{drive:0.22,tone:0.08,space:0.01,transient:0.18,noise:-0.02,air:0.06,comp:0.2},
    corrode:{drive:0.36,tone:-0.12,space:-0.06,transient:0.1,noise:0.18,air:-0.04,comp:0.28},
    metallic:{drive:0.14,tone:0.14,space:0.02,transient:0.16,noise:0.08,air:0.18,comp:0.18},
    dust:{drive:0.08,tone:-0.04,space:0.05,transient:-0.02,noise:0.14,air:-0.02,comp:0.1},
    deep:{drive:0.06,tone:-0.1,space:0.12,transient:0.04,noise:-0.06,air:0.02,comp:0.14},
  },
  bass:{
    acid_bite:{drive:0.28,filter:0.16,motion:0.12,detune:0.008,air:0.0,layer:0.22},
    iron_weight:{drive:0.24,filter:-0.08,motion:0.02,detune:0.004,air:-0.02,layer:0.28},
    sub_pressure:{drive:0.12,filter:-0.04,motion:0.06,detune:0.002,air:0.0,layer:0.2},
    spectral:{drive:0.08,filter:0.08,motion:0.16,detune:0.012,air:0.1,layer:0.14},
    cinematic_pulse:{drive:0.04,filter:0.02,motion:0.04,detune:0.006,air:0.06,layer:0.18},
  },
  synth:{
    glass_bloom:{drive:0.04,filter:0.12,motion:0.12,space:0.08,width:0.16,air:0.16,chord:0.16},
    razor_shard:{drive:0.24,filter:0.08,motion:0.08,space:-0.04,width:0.04,air:0.04,chord:-0.08},
    hollow_choir:{drive:0.02,filter:-0.02,motion:0.06,space:0.12,width:0.18,air:0.1,chord:0.22},
    tape_haze:{drive:0.08,filter:-0.06,motion:0.02,space:0.14,width:0.12,air:-0.02,chord:0.1},
    wide_cinema:{drive:0.03,filter:0.04,motion:0.04,space:0.18,width:0.22,air:0.08,chord:0.24},
  },
};
const GENRE_SOUND_FAMILY_MAP={
  acid:{drums:'pressure',bass:'acid_bite',synth:'razor_shard'},
  industrial:{drums:'corrode',bass:'iron_weight',synth:'razor_shard'},
  dnb:{drums:'metallic',bass:'sub_pressure',synth:'glass_bloom'},
  cinematic:{drums:'deep',bass:'cinematic_pulse',synth:'wide_cinema'},
  experimental:{drums:'dust',bass:'spectral',synth:'tape_haze'},
};
const getGenreSoundFamilies=genre=>GENRE_SOUND_FAMILY_MAP[genre]||GENRE_SOUND_FAMILY_MAP.acid;
const getSoundFamilyConfig=(kind,family)=>SOUND_FAMILY_PROFILES[kind]?.[family]||Object.values(SOUND_FAMILY_PROFILES[kind]||{})[0]||{};

const GENRE_MIX_PROFILES={
  acid:{drumAir:0.08,drumOpen:0.1,drumDrive:0.08,bassBody:0.06,synthAir:0.02},
  industrial:{drumAir:-0.02,drumOpen:-0.04,drumDrive:0.18,bassBody:0.1,synthAir:-0.04},
  dnb:{drumAir:0.12,drumOpen:0.12,drumDrive:0.04,bassBody:0.12,synthAir:0.06},
  cinematic:{drumAir:0.04,drumOpen:0.0,drumDrive:-0.02,bassBody:0.04,synthAir:0.14},
  experimental:{drumAir:0.1,drumOpen:0.06,drumDrive:0.06,bassBody:0.08,synthAir:0.12},
};
const getGenreMixProfile=genre=>GENRE_MIX_PROFILES[genre]||GENRE_MIX_PROFILES.acid;


const DRUM_VOICE_PROFILES={
  kick:[
    {name:'sub_round',body:1.18,click:0.18,sub:1.18,tail:0.16,brightness:-0.18,pitch:0.96,decay:1.12,drive:0.04},
    {name:'punch_club',body:1.0,click:0.54,sub:0.9,tail:0.1,brightness:0.04,pitch:1.0,decay:0.92,drive:0.08},
    {name:'hard_clipped',body:0.88,click:0.82,sub:0.72,tail:0.06,brightness:0.14,pitch:1.06,decay:0.76,drive:0.18},
    {name:'hollow_box',body:0.78,click:0.34,sub:0.76,tail:0.22,brightness:-0.08,pitch:0.99,decay:1.02,drive:0.06},
    {name:'dirty_industrial',body:1.06,click:0.72,sub:0.82,tail:0.18,brightness:0.0,pitch:0.94,decay:0.98,drive:0.24},
    {name:'cinematic_boom',body:0.96,click:0.12,sub:1.02,tail:0.34,brightness:-0.16,pitch:0.9,decay:1.24,drive:0.05},
    {name:'tight_dry',body:0.86,click:0.48,sub:0.7,tail:0.05,brightness:0.1,pitch:1.04,decay:0.72,drive:0.1},
    {name:'long_boom',body:1.02,click:0.22,sub:1.14,tail:0.26,brightness:-0.12,pitch:0.92,decay:1.32,drive:0.08},
    {name:'rubber_thump',body:0.94,click:0.28,sub:1.0,tail:0.14,brightness:-0.04,pitch:0.98,decay:0.88,drive:0.12},
    {name:'glassy_punch',body:0.82,click:0.92,sub:0.66,tail:0.04,brightness:0.2,pitch:1.08,decay:0.68,drive:0.16},
  ],
  snare:[
    {name:'dry_snap',noise:0.56,body:0.58,snap:0.76,brightness:0.08,decay:0.82,metal:0.04},
    {name:'body_crack',noise:0.42,body:0.98,snap:0.56,brightness:0.0,decay:1.02,metal:0.0},
    {name:'metallic_crack',noise:0.72,body:0.66,snap:0.88,brightness:0.16,decay:0.92,metal:0.22},
    {name:'dusty_snare',noise:0.64,body:0.46,snap:0.42,brightness:-0.08,decay:1.06,metal:0.02},
    {name:'clap_hybrid',noise:0.78,body:0.52,snap:0.72,brightness:0.12,decay:0.94,metal:0.0},
    {name:'gated_hit',noise:0.52,body:0.74,snap:0.68,brightness:0.02,decay:0.68,metal:0.06},
    {name:'wide_rave',noise:0.8,body:0.58,snap:0.76,brightness:0.14,decay:1.1,metal:0.04},
    {name:'industrial_noise',noise:0.96,body:0.44,snap:0.7,brightness:0.04,decay:0.88,metal:0.18},
    {name:'papery_clap',noise:0.74,body:0.38,snap:0.62,brightness:0.1,decay:0.86,metal:0.0},
    {name:'cinema_thud',noise:0.34,body:1.04,snap:0.48,brightness:-0.06,decay:1.18,metal:0.0},
  ],
  hat:[
    {name:'crisp_closed',noise:0.58,air:0.16,brightness:0.14,decay:0.82,open:0.84,pan:0.08},
    {name:'dusty_tick',noise:0.46,air:-0.04,brightness:-0.04,decay:0.92,open:0.9,pan:0.06},
    {name:'noisy_hat',noise:0.84,air:0.08,brightness:0.06,decay:1.0,open:1.04,pan:0.1},
    {name:'metallic_hat',noise:0.64,air:0.02,brightness:0.18,decay:0.88,open:0.96,pan:0.12},
    {name:'soft_air',noise:0.34,air:0.22,brightness:0.04,decay:1.06,open:1.08,pan:0.08},
    {name:'broken_digital',noise:0.72,air:0.12,brightness:0.12,decay:0.84,open:0.9,pan:0.14},
    {name:'wash_open',noise:0.62,air:0.26,brightness:0.08,decay:1.16,open:1.24,pan:0.16},
    {name:'sharp_narrow',noise:0.48,air:0.04,brightness:0.2,decay:0.74,open:0.82,pan:0.06},
    {name:'glass_air',noise:0.42,air:0.32,brightness:0.22,decay:0.94,open:1.06,pan:0.12},
    {name:'sand_sizzle',noise:0.9,air:0.18,brightness:0.02,decay:1.08,open:1.14,pan:0.18},
  ],
};

function chooseDrumVoice(kind,sectionName,genre,accent,energy,variation={}){
  const bank=DRUM_VOICE_PROFILES[kind]||[];
  if(!bank.length)return {};
  const sec=sectionName||'groove';
  let idx=0;
  if(kind==='kick'){
    if(sec==='drop') idx=accent>0.95?1:6;
    else if(sec==='build') idx=accent>0.9?9:2;
    else if(sec==='break') idx=energy<0.35?5:8;
    else if(sec==='fill') idx=4;
    else if(sec==='outro') idx=8;
    else idx=0;
    if(genre==='industrial') idx=accent>0.92?4:3;
    else if(genre==='cinematic') idx=energy<0.4?5:7;
    else if(genre==='dnb') idx=accent>0.96?1:9;
    else if(genre==='experimental') idx=variation.variant?3:8;
    else if(genre==='acid') idx=accent>0.94?9:2;
  } else if(kind==='snare'){
    if(sec==='drop') idx=1;
    else if(sec==='build') idx=2;
    else if(sec==='break') idx=9;
    else if(sec==='fill') idx=5;
    else if(sec==='outro') idx=8;
    else idx=0;
    if(genre==='industrial') idx=accent>0.9?7:2;
    else if(genre==='cinematic') idx=energy<0.45?9:8;
    else if(genre==='experimental') idx=variation.variant?2:4;
    else if(genre==='dnb') idx=accent>0.9?2:0;
    else if(genre==='acid') idx=4;
  } else if(kind==='hat'){
    if(sec==='drop') idx=0;
    else if(sec==='build') idx=3;
    else if(sec==='break') idx=8;
    else if(sec==='fill') idx=5;
    else if(sec==='outro') idx=1;
    else idx=9;
    if(genre==='industrial') idx=variation.variant?3:2;
    else if(genre==='cinematic') idx=energy>0.55?6:8;
    else if(genre==='experimental') idx=variation.variant?5:9;
    else if(genre==='dnb') idx=variation.variant?6:0;
    else if(genre==='acid') idx=variation.variant?7:0;
  }
  if(energy>0.82 && kind==='kick') idx=(idx+1)%bank.length;
  if(energy<0.34 && kind==='hat') idx=8;
  const base=bank[idx%bank.length];
  const alt=bank[(idx + (variation.variant?1:0) + ((variation.variantBias||0)>0.12?1:0) + (accent>0.94?1:0))%bank.length];
  return ((variation.variantBias||0)>0.12 || accent>0.95) && rnd()<0.58 ? alt : base;
}

function getDrumContextModifiers(kind,sectionName,energy,accent,variation={},voice={},genre='acid'){
  const sec=sectionName||'groove';
  const accentStrong=accent>0.9;
  const mix=getGenreMixProfile(genre);
  const toneOpen=(sec==='drop'?1.18:sec==='build'?1.08:sec==='break'?0.94:sec==='fill'?1.1:1.0) + (voice.brightness||0)*0.18 + (variation.toneShift||0)*0.08 + energy*0.06 + (mix.drumOpen||0);
  const decayMul=(sec==='drop'?0.96:sec==='build'?0.88:sec==='break'?1.08:sec==='fill'?0.9:1.0) * (voice.decay||1) * (accentStrong?0.98:1.03);
  const transientMul=(accentStrong?1.18:0.96) * (1 + (voice.click||voice.snap||0)*0.08);
  const driveMul=1 + (voice.drive||voice.metal||0)*0.35 + (sec==='fill'?0.06:0) + (variation.variantBias||0)*0.1 + (mix.drumDrive||0);
  const airMul=(sec==='break'?1.22:sec==='build'?1.08:1.0) * (1 + (voice.air||0)*0.4 + (mix.drumAir||0));
  const openMul=(voice.open||1) * (sec==='break'?1.08:sec==='build'?1.02:1.0);
  return {toneOpen,decayMul,transientMul,driveMul,airMul,openMul};
}

// ─── GENRE DNA ────────────────────────────────────────────────────────────────
const GENRES={
  dnb:{bpm:[160,180],kick:'syncopated',swing:0.04,atmosphere:'jungle pressure',
    kickFreq:95,kickEnd:35,kickDecay:0.14,noiseColor:'white',
    modes:['minor','dorian'],density:0.78,chaos:0.55,
    bassMode:'grit',synthMode:'glass',fxProfile:{drive:0.35,space:0.3,tone:0.5},
    hatPattern:'breakbeat',description:'Fast broken jungle'},
  acid:{bpm:[125,138],kick:'every4',swing:0.05,atmosphere:'303 acid',
    kickFreq:85,kickEnd:32,kickDecay:0.18,noiseColor:'white',
    modes:['phrygian','chroma'],density:0.68,chaos:0.65,
    bassMode:'bit',synthMode:'mist',fxProfile:{drive:0.45,space:0.35,tone:0.4},
    hatPattern:'16th',description:'Squelching resonant acid'},
  industrial:{bpm:[130,150],kick:'every4',swing:0.0,atmosphere:'concrete noise',
    kickFreq:70,kickEnd:28,kickDecay:0.28,noiseColor:'brown',
    modes:['chroma','phrygian'],density:0.8,chaos:0.75,
    bassMode:'fold',synthMode:'air',fxProfile:{drive:0.55,space:0.25,tone:0.35},
    hatPattern:'noise',description:'Harsh mechanical noise'},
  experimental:{bpm:[80,160],kick:'irregular',swing:0.08,atmosphere:'avant-garde',
    kickFreq:100,kickEnd:45,kickDecay:0.25,noiseColor:'pink',
    modes:['chroma','lydian'],density:0.45,chaos:0.88,
    bassMode:'wet',synthMode:'strings',fxProfile:{drive:0.2,space:0.7,tone:0.6},
    hatPattern:'random',description:'Unpredictable textural'},
  cinematic:{bpm:[85,110],kick:'sparse',swing:0.03,atmosphere:'epic orchestral',
    kickFreq:75,kickEnd:30,kickDecay:0.32,noiseColor:'pink',
    modes:['minor','lydian'],density:0.38,chaos:0.35,
    bassMode:'drone',synthMode:'strings',fxProfile:{drive:0.05,space:0.85,tone:0.85},
    hatPattern:'sparse',description:'Dramatic cinematic score'},
};
const GENRE_NAMES=Object.keys(GENRES);

// ─── MUSICAL THEORY ───────────────────────────────────────────────────────────
const MODES={
  minor:   {b:['C2','D2','Eb2','F2','G2','Ab2','Bb2','C3','D3','Eb3'],s:['C4','D4','Eb4','F4','G4','Ab4','Bb4','C5','D5','Eb5']},
  phrygian:{b:['C2','Db2','Eb2','F2','G2','Ab2','Bb2','C3','Db3','Eb3'],s:['C4','Db4','Eb4','F4','G4','Ab4','Bb4','C5','Db5','Eb5']},
  dorian:  {b:['C2','D2','Eb2','F2','G2','A2','Bb2','C3','D3','Eb3'],s:['C4','D4','Eb4','F4','G4','A4','Bb4','C5','D5','Eb5']},
  chroma:  {b:['C2','Db2','D2','Eb2','E2','F2','G2','Ab2','A2','Bb2'],s:['C4','Db4','D4','Eb4','E4','F4','G4','Ab4','A4','Bb4']},
  mixo:    {b:['C2','D2','E2','F2','G2','A2','Bb2','C3','D3','E3'],s:['C4','D4','E4','F4','G4','A4','Bb4','C5','D5','E5']},
  lydian:  {b:['C2','D2','E2','F#2','G2','A2','B2','C3','D3','E3'],s:['C4','D4','E4','F#4','G4','A4','B4','C5','D5','E5']},
};

const CHORD_PROGS={
  minor:[
    [{r:0,t:2,f:4},{r:5,t:0,f:2},{r:3,t:5,f:0},{r:4,t:0,f:2}],
    [{r:0,t:2,f:4},{r:3,t:5,f:0},{r:4,t:0,f:2},{r:0,t:2,f:4}],
    [{r:0,t:2,f:4},{r:0,t:2,f:4},{r:3,t:5,f:0},{r:3,t:5,f:0}],
    [{r:0,t:2,f:4},{r:4,t:0,f:2},{r:3,t:5,f:0},{r:6,t:1,f:3}],
  ],
  phrygian:[
    [{r:0,t:1,f:3},{r:1,t:3,f:5},{r:3,t:5,f:0},{r:1,t:3,f:5}],
    [{r:0,t:1,f:3},{r:0,t:1,f:3},{r:1,t:3,f:5},{r:1,t:3,f:5}],
  ],
  dorian:[
    [{r:0,t:2,f:4},{r:5,t:0,f:2},{r:3,t:5,f:0},{r:4,t:0,f:2}],
    [{r:0,t:2,f:4},{r:4,t:6,f:1},{r:3,t:5,f:0},{r:0,t:2,f:4}],
  ],
  mixo:[
    [{r:0,t:2,f:4},{r:6,t:1,f:3},{r:4,t:6,f:1},{r:0,t:2,f:4}],
    [{r:0,t:2,f:4},{r:0,t:2,f:4},{r:6,t:1,f:3},{r:6,t:1,f:3}],
  ],
  lydian:[
    [{r:0,t:2,f:4},{r:3,t:5,f:0},{r:4,t:6,f:1},{r:2,t:4,f:6}],
  ],
  chroma:[
    [{r:0,t:1,f:4},{r:3,t:6,f:1},{r:7,t:2,f:5},{r:4,t:9,f:2}],
    [{r:0,t:3,f:6},{r:1,t:4,f:7},{r:2,t:5,f:8},{r:0,t:3,f:6}],
  ],
};

// Song sections with musical character
const SECTIONS={
  intro:   {kM:0.3,sM:0.2,hM:0.4,bM:0.5,syM:0.6,vel:'rise',pb:0.45,lb:3,bars:4},
  build:   {kM:0.7,sM:0.6,hM:1.0,bM:0.9,syM:0.8,vel:'rise',pb:0.6,lb:1.5,bars:4},
  drop:    {kM:1.3,sM:1.1,hM:0.9,bM:1.2,syM:0.8,vel:'accent',pb:0.85,lb:1,bars:8},
  groove:  {kM:1.0,sM:1.0,hM:1.0,bM:1.0,syM:0.9,vel:'groove',pb:0.72,lb:1.2,bars:8},
  break:   {kM:0.1,sM:0.3,hM:0.2,bM:0.4,syM:1.5,vel:'flat',pb:0.4,lb:4,bars:4},
  tension: {kM:0.5,sM:0.7,hM:1.4,bM:1.0,syM:1.1,vel:'accent',pb:0.55,lb:1.5,bars:4},
  outro:   {kM:0.4,sM:0.3,hM:0.3,bM:0.3,syM:0.4,vel:'fall',pb:0.35,lb:2.5,bars:4},
  fill:    {kM:1.6,sM:1.5,hM:0.6,bM:0.7,syM:0.4,vel:'accent',pb:0.75,lb:0.5,bars:2},
};

// Song arc templates — sequences of sections that tell a story
const SONG_ARCS=[
  ['intro','build','drop','groove','break','build','drop','outro'],
  ['intro','groove','tension','drop','break','drop','outro'],
  ['build','drop','groove','fill','drop','break','outro'],
  ['intro','tension','build','drop','groove','drop','outro'],
  ['groove','groove','break','tension','drop','groove','outro'],
];

const GROOVE_MAPS={
  steady:{kB:0.22,sB:0.16,hB:0.58,bB:0.22,syB:0.12},
  broken:{kB:0.28,sB:0.14,hB:0.46,bB:0.28,syB:0.18},
  bunker:{kB:0.34,sB:0.10,hB:0.34,bB:0.24,syB:0.14},
  float: {kB:0.16,sB:0.12,hB:0.50,bB:0.18,syB:0.28},
};

const NOTE_FREQ={
  C2:65.41,Db2:69.3,D2:73.42,Eb2:77.78,E2:82.41,F2:87.31,'F#2':92.5,G2:98,Ab2:103.83,A2:110,Bb2:116.54,B2:123.47,
  C3:130.81,Db3:138.59,D3:146.83,Eb3:155.56,E3:164.81,F3:174.61,G3:196,A3:220,Bb3:233.08,B3:246.94,
  C4:261.63,Db4:277.18,D4:293.66,Eb4:311.13,E4:329.63,F4:349.23,'F#4':370,'G4':392,Ab4:415.3,A4:440,Bb4:466.16,B4:493.88,
  C5:523.25,Db5:554.37,D5:587.33,Eb5:622.25,F5:698.46,G5:783.99,A5:880,
};
const NOTE_MIDI={
  C2:36,D2:38,Eb2:39,E2:40,F2:41,'F#2':42,G2:43,Ab2:44,A2:45,Bb2:46,
  C3:48,D3:50,Eb3:51,G3:55,A3:57,
  C4:60,D4:62,Eb4:63,E4:64,F4:65,G4:67,Ab4:68,A4:69,Bb4:70,
  C5:72,D5:74,Eb5:75,G5:79,A5:81,
};
const CHROMA=['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const parseNoteName=n=>{const m=String(n||'').match(/^([A-G](?:b|#)?)(-?\d+)$/);return m?{name:m[1],oct:Number(m[2])}:null;};
const transposeNote=(note,semitones)=>{
  const parsed=parseNoteName(note);
  if(!parsed)return note;
  const idx=CHROMA.indexOf(parsed.name);
  if(idx===-1)return note;
  const abs=parsed.oct*12+idx+semitones;
  const nextIdx=((abs%12)+12)%12;
  const nextOct=Math.floor(abs/12);
  return `${CHROMA[nextIdx]}${nextOct}`;
};

const mkSteps=()=>Array.from({length:MAX_STEPS},()=>({on:false,p:1,v:1,l:1}));
const mkNotes=(d='C2')=>Array.from({length:MAX_STEPS},()=>d);

// ─── MUSIC GENERATION ENGINE ──────────────────────────────────────────────────
function chordNotes(chord,pool){
  const n=pool.length;
  return[pool[chord.r%n],pool[chord.t%n],pool[chord.f%n]].filter(Boolean);
}

function voiceLead(cur,pool){
  if(!pool.length)return cur;
  const i=pool.indexOf(cur);if(i===-1)return pool[Math.floor(rnd()*pool.length)];
  const r=rnd();
  if(r<0.5)return pool[Math.min(i+1,pool.length-1)];
  if(r<0.78)return pool[Math.max(i-1,0)];
  return pool[clamp(i+(rnd()<0.5?2:-2),0,pool.length-1)];
}

function arp(notes,mode,step){
  if(!notes||!notes.length)return'C4';
  const n=notes.length;
  switch(mode){
    case'up':return notes[step%n];
    case'down':return notes[(n-1-step%n)];
    case'updown':{const p=Math.max(1,n*2-2);const s=step%p;return s<n?notes[s]:notes[p-s];}
    case'outside':{const s=step%n;return s%2===0?notes[Math.floor(s/2)]:notes[n-1-Math.floor(s/2)];}
    default:return notes[step%n];
  }
}

function velCurve(type,i,total,pw){
  const t=i/total;
  switch(type){
    case'rise':return clamp(0.3+t*0.7*pw,0.2,1);
    case'fall':return clamp(0.95-t*0.6,0.15,1);
    case'accent':return i%4===0?clamp(0.88+pw*0.12,0.65,1):clamp(0.48+pw*0.28,0.25,0.82);
    case'groove':return i%8===0?0.95:i%4===0?0.76:i%2===0?0.60:0.42+rnd()*0.18;
    case'flat':return clamp(0.55+pw*0.2,0.38,0.82);
    default:return clamp(0.45+pw*0.55,0.28,1);
  }
}

// ─── MELODIC PHRASE BUILDER ───────────────────────────────────────────────────
// Creates real melodic phrases: 4-bar motifs, repetitions, silences, legato
function sectionEnergy(sectionName){
  const T={intro:0.24,build:0.56,drop:1,groove:0.74,break:0.2,tension:0.68,outro:0.18,fill:0.86};
  return T[sectionName] ?? 0.6;
}

function getCharacterConfig(name){
  return SOUND_CHARACTERS[name]||SOUND_CHARACTERS.tight;
}

function computeMacroEnergy(sectionName, blueprint=null, cycleIndex=0, visitCount=0){
  const base=sectionEnergy(sectionName);
  const profile=blueprint?.macroEnergyCurve||[0.9,1.02,0.96,1.08];
  const charCfg=getCharacterConfig(blueprint?.soundCharacter);
  const curve=profile[(cycleIndex+visitCount)%profile.length]||1;
  const revisit=visitCount>0?Math.min(0.12,visitCount*0.03):0;
  return clamp(base*curve+revisit+charCfg.accentBias*0.35,0.12,1);
}

function createStructuredBarProfile(sectionName,totalBars,visitCount,cycleIndex,macroEnergy,characterName){
  const charCfg=getCharacterConfig(characterName);
  const last=Math.max(1,totalBars)-1;
  const visitLift=Math.min(0.08,visitCount*0.02);
  return Array.from({length:Math.max(1,totalBars)},(_,barIndex)=>{
    const t=last<=0?1:barIndex/last;
    let shape=1;
    if(sectionName==='intro')shape=0.72+t*0.28;
    else if(sectionName==='build')shape=0.78+t*0.34;
    else if(sectionName==='drop')shape=1.08-(barIndex%4===3?0.08:0)+(t>0.45?0.06:0);
    else if(sectionName==='groove')shape=[1,0.94,1.03,0.9][barIndex%4]||1;
    else if(sectionName==='break')shape=0.62+(1-t)*0.16;
    else if(sectionName==='tension')shape=0.92+t*0.24+(barIndex===last?0.08:0);
    else if(sectionName==='fill')shape=1.06+(barIndex===last?0.12:0.05);
    else if(sectionName==='outro')shape=1.02-t*0.28;
    shape+=charCfg.motionBias*0.12+visitLift;
    shape*=0.9+macroEnergy*0.16;
    return clamp(shape,0.55,1.24);
  });
}


function mergeCharacterAndGenre(name, genre){
  const charCfg=getCharacterConfig(name);
  const fam=getGenreFamilyProfile(genre);
  return{
    ...charCfg,
    toneBias:charCfg.toneBias+fam.tone,
    spaceBias:charCfg.spaceBias+fam.space,
    driveBias:charCfg.driveBias+fam.drive,
    accentBias:charCfg.accentBias+fam.accent,
    motionBias:charCfg.motionBias+fam.motion,
  };
}

function scoreHook(notes,pool,lane,sectionName){
  const seq=(notes||[]).filter(Boolean);
  if(seq.length<3)return 0;
  const uniq=new Set(seq).size;
  const motion=seq.slice(1).reduce((acc,n,i)=>acc+Math.abs((pool.indexOf(n)??0)-(pool.indexOf(seq[i])??0)),0);
  const repeated=Math.max(0,seq.length-uniq);
  const contourBonus=seq[0]===seq[seq.length-1]?0.35:0;
  const laneBias=lane==='synth'?0.28:0.18;
  const sectionBias=sectionName==='drop'||sectionName==='groove'?0.22:sectionName==='build'?0.12:0;
  return repeated*0.24 + motion*0.04 + contourBonus + laneBias + sectionBias;
}

function extractHookCandidates(line, active, lane, pool, sectionName){
  const candidates=[];
  for(let start=0; start<=Math.min(line.length-4,16); start+=2){
    const slice=line.slice(start,start+6).filter(Boolean);
    const activeCount=(active||[]).slice(start,start+6).filter(Boolean).length;
    if(slice.length>=3 && activeCount>=2){
      candidates.push({
        notes:slice.slice(0,4),
        score:scoreHook(slice,pool,lane,sectionName)+activeCount*0.08-(start*0.01),
      });
    }
  }
  return candidates.sort((a,b)=>b.score-a.score).slice(0,2);
}

function getHookRecallWeight(sectionName, genre){
  const fam=getGenreFamilyProfile(genre);
  const sectionBias={intro:0.08,build:0.42,drop:0.88,groove:0.76,break:0.24,tension:0.54,outro:0.18,fill:0.34};
  return clamp((sectionBias[sectionName]??0.4)*fam.hookBias,0.06,0.92);
}

function chooseTransitionFillMode(sectionName,memory,genre){
  const recent=memory?.recentSections||[];
  const prev=recent[recent.length-1]||null;
  const fam=getGenreFamilyProfile(genre);
  if(sectionName==='fill'){
    if(prev==='break')return 're-entry';
    if(prev==='build'||prev==='tension')return fam.fillBias==='break'?'break-rush':'lift';
    if(prev==='drop'||prev==='groove')return fam.fillBias==='air'?'air-gap':'roll';
    return fam.fillBias||'impact';
  }
  if(sectionName==='drop'&&(prev==='break'||prev==='build'||prev==='tension'))return 'release';
  if(sectionName==='break'&&(prev==='drop'||prev==='groove'))return 'strip';
  return 'neutral';
}

function createCompositionBlueprint(genre, modeName, progression, arpeMode){
  const contour=[0];
  for(let i=1;i<8;i++){
    const move=pick([-2,-1,-1,0,1,1,2]);
    contour.push(clamp(contour[i-1]+move,-3,4));
  }
  const rhythmicSets={
    bass:[
      [0,4,7,10,12],
      [0,3,6,8,12,14],
      [0,5,8,11,12],
      [0,2,7,10,12,15],
    ],
    synth:[
      [2,6,10,14],
      [3,7,11,15],
      [2,5,10,13,14],
      [1,6,9,14],
    ],
  };
  const hookShift=pick([-2,-1,1,2]);
  const soundCharacter=getGenreSoundCharacter(genre);
  const genreFamily=getGenreFamilyProfile(genre);
  const soundFamilies=getGenreSoundFamilies(genre);
  const bassMotifs=choosePrimaryMotifSet((MODES[modeName]||MODES.minor).b,contour,progression,'bass');
  const synthMotifs=choosePrimaryMotifSet((MODES[modeName]||MODES.minor).s,contour.map((v,i)=>v+(i%3===2?hookShift:0)),progression,'synth');
  return{
    id:`${genre}-${modeName}-${Date.now()}-${Math.floor(rnd()*9999)}`,
    genre,modeName,arpeMode,progression,
    soundCharacter,
    genreFamily,
    soundFamilies,
    primaryMotifs:{bass:bassMotifs.primary,synth:synthMotifs.primary},
    motifBanks:{bass:bassMotifs.candidates,synth:synthMotifs.candidates},
    macroEnergyCurve:pick([[0.92,1.02,0.96,1.08],[0.9,0.98,1.04,1.1],[0.88,1.0,0.95,1.12]]),
    contour,
    bassRhythm:pick(rhythmicSets.bass).slice(),
    synthRhythm:pick(rhythmicSets.synth).slice(),
    hookShift,
    answerBias:0.28+rnd()*0.26,
    repetitionBias:0.58+rnd()*0.18,
    mutationBias:0.16+rnd()*0.18,
    memory:{
      bassMotif:null,
      synthMotif:null,
      previousBassTail:null,
      previousSynthTail:null,
      sectionVisits:{},
      recentSections:[],
      sectionHistory:[],
      hooks:[],
      laneHooks:{bass:[],synth:[]},
      energyHistory:[],
      cadenceBySection:{},
      phraseMemory:{bass:[],synth:[]},
      lastTransform:null,
      primaryHooks:{},
      lastStrongHook:null,
    },
  };
}

function evolveRhythm(base, lane, sectionName, chaos, cycleIndex){
  const evolved=[...base];
  if(sectionName==='fill')return Array.from(new Set([...evolved,12,13,14,15])).sort((a,b)=>a-b);
  if(sectionName==='break')return evolved.filter(p=>lane==='bass'?p===0||p===8:p===2||p===10);
  if(sectionName==='intro')return evolved.filter((_,i)=>i<Math.max(2,Math.ceil(evolved.length*0.55)));
  if(sectionName==='outro')return evolved.filter((p,i)=>i<Math.max(2,Math.ceil(evolved.length*0.45))&&p<12);
  if(sectionName==='build'){
    evolved.push(14);
    if(cycleIndex%2===1)evolved.push(15);
  }
  if(sectionName==='drop'){
    evolved.push(lane==='bass'?15:13);
    if(chaos>0.45)evolved.push(lane==='bass'?11:9);
  }
  return Array.from(new Set(evolved.filter(p=>p>=0&&p<16))).sort((a,b)=>a-b);
}

function motifStepToNote(stepHint, chordNotePool, globalPool, previous){
  const source=(chordNotePool&&chordNotePool.length)?chordNotePool:[globalPool[0]];
  const fallback=source[0] || globalPool[0];
  const baseIdx=Math.max(0,globalPool.indexOf(fallback));
  const target=baseIdx+stepHint;
  const candidates=source.slice().sort((a,b)=>{
    const da=Math.abs(globalPool.indexOf(a)-target);
    const db=Math.abs(globalPool.indexOf(b)-target);
    return da-db;
  });
  if(previous && candidates.includes(previous) && rnd()<0.18)return previous;
  return candidates[0] || fallback;
}

function chooseLength(sectionName, lane, lenBias, localStep, energy){
  const anchor=(localStep%8===0);
  const cadence=(localStep%16===14||localStep%16===15);
  if(sectionName==='break')return Math.min(12,Math.max(1.5,lenBias*(lane==='synth'?3.8:2.4)));
  if(sectionName==='fill')return Math.max(0.5,lenBias*(anchor?0.9:0.5));
  if(sectionName==='drop')return Math.max(0.5,lenBias*(anchor?(lane==='synth'?1.8:1.35):(lane==='synth'?0.9:0.82)));
  if(sectionName==='intro'||sectionName==='outro')return Math.min(12,Math.max(1,lenBias*(anchor?(lane==='synth'?3.2:2.6):(lane==='synth'?2:1.6))));
  if(sectionName==='cinematic')return Math.min(16,Math.max(1.5,lenBias*(anchor?4.4:2.8)));
  const laneBias=lane==='synth'?(anchor?2.2:1.18+energy*0.9):lane==='bass'?(anchor?1.8:1.05+energy*0.42):(anchor?1.4:1.0);
  const cadenceLift=cadence&&lane==='synth'?1.35:1;
  return Math.min(12,Math.max(0.5,lenBias*laneBias*cadenceLift));
}

function createMotifCandidates(pool, contour, chordProgression, lane='synth'){
  const firstChord=chordProgression?.[0];
  const chordPool=firstChord?chordNotes(firstChord,pool):pool.slice(0,3);
  const seeds=[];
  for(let c=0;c<4;c++){
    let prev=chordPool[0]||pool[0];
    const localShift=(c-1.5);
    const notes=Array.from({length:8},(_,idx)=>{
      if(idx>0 && rnd()<(lane==='bass'?0.08:0.14) && c!==0)return null;
      const stepHint=(contour?.[idx]??0)+localShift+(lane==='bass'&&idx%3===0?-1:0);
      const note=motifStepToNote(stepHint,chordPool,pool,prev);
      prev=note||prev;
      return note;
    });
    const active=notes.filter(Boolean).length;
    const uniq=new Set(notes.filter(Boolean)).size;
    const leaps=notes.filter(Boolean).slice(1).reduce((acc,n,idx,arr)=>acc+Math.abs(noteIndexSafe(pool,n)-noteIndexSafe(pool,arr[idx])),0);
    const score=active*0.24+uniq*0.34+(lane==='bass'?(uniq<=4?0.32:0.12):(uniq>=3?0.24:0.08))+Math.min(0.3,leaps*0.015);
    seeds.push({notes,score});
  }
  return seeds.sort((a,b)=>b.score-a.score);
}

function choosePrimaryMotifSet(pool, contour, chordProgression, lane='synth'){
  const candidates=createMotifCandidates(pool, contour, chordProgression, lane);
  return {primary:(candidates[0]?.notes)||[],secondary:(candidates[1]?.notes)||(candidates[0]?.notes)||[],candidates};
}


function noteIndexSafe(pool,note){
  const idx=pool.indexOf(note);
  return idx===-1?0:idx;
}

function nearestPoolNote(target,pool,prefer=[]) {
  const source=[...new Set([...(prefer||[]).filter(Boolean),...(pool||[]).filter(Boolean)])];
  if(!source.length)return target||'C4';
  const targetIdx=noteIndexSafe(pool,target||source[0]);
  return source.reduce((best,n)=>{
    const d=Math.abs(noteIndexSafe(pool,n)-targetIdx);
    const bd=Math.abs(noteIndexSafe(pool,best)-targetIdx);
    return d<bd?n:best;
  },source[0]);
}

function classifyChordFunction(chord,pool){
  const root=chord?.r ?? 0;
  const degree=((root%7)+7)%7;
  if(degree===0)return 'tonic';
  if(degree===4||degree===6)return 'dominant';
  if(degree===3||degree===1)return 'predominant';
  return 'color';
}

function chooseTargetTone(chordPool,pool,lane,sectionName,functionType,energy,previous){
  const triad=(chordPool&&chordPool.length)?chordPool:[pool[0]];
  const root=triad[0]||pool[0];
  const third=triad[1]||root;
  const fifth=triad[2]||third;
  const choices = lane==='bass'
    ? (functionType==='dominant'?[root,fifth,root] : functionType==='predominant'?[root,third,root] : [root,root,fifth])
    : (functionType==='dominant'?[third,fifth,third,root] : functionType==='predominant'?[third,root,fifth,third] : [root,third,fifth,third]);
  const preferred=choices.filter(Boolean);
  const resolved=nearestPoolNote(previous||preferred[0], pool, preferred);
  if(sectionName==='break'&&lane==='synth'&&rnd()<0.45)return nearestPoolNote(third,pool,[third,fifth]);
  if(sectionName==='drop'&&energy>0.8&&lane==='synth'&&rnd()<0.35)return nearestPoolNote(fifth,pool,[fifth,third]);
  if(rnd()<0.62)return resolved;
  return preferred[Math.floor(rnd()*preferred.length)]||resolved;
}

function choosePassingTone(current,target,pool,lane,energy){
  if(!current||!target)return target||current||pool[0];
  const ci=noteIndexSafe(pool,current), ti=noteIndexSafe(pool,target);
  const diff=ti-ci;
  if(Math.abs(diff)<=1)return target;
  const step=diff>0?1:-1;
  const leapBias=lane==='bass'?0.26:0.18;
  if(rnd()<clamp(leapBias-energy*0.1,0.08,0.28))return target;
  const mid=pool[clamp(ci+step,0,pool.length-1)]||target;
  return rnd()<0.18 && Math.abs(diff)>2 ? (pool[clamp(ci+step*2,0,pool.length-1)]||mid) : mid;
}

function getSynthChordVoicing(baseNote,pool,sectionName='groove',style='triad'){
  const idx=noteIndexSafe(pool,baseNote);
  const third=pool[clamp(idx+2,0,pool.length-1)]||transposeNote(baseNote,4);
  const fifth=pool[clamp(idx+4,0,pool.length-1)]||transposeNote(baseNote,7);
  const seventh=pool[clamp(idx+6,0,pool.length-1)]||transposeNote(baseNote,10);
  const add9=pool[clamp(idx+8,0,pool.length-1)]||transposeNote(baseNote,14);
  if(style==='open')return [...new Set([baseNote,fifth,add9])];
  if(style==='seventh')return [...new Set([baseNote,third,fifth,seventh])];
  if(sectionName==='break'||sectionName==='outro')return [...new Set([baseNote,fifth,add9])];
  return [...new Set([baseNote,third,fifth])];
}

function applySynthExpression(line,lengths,active,pool,sectionName='groove',opts={}){
  const chordChance=clamp(opts.chordChance??0.36,0,1);
  const holdAmt=clamp(opts.holdAmt??0.5,0,1);
  const curve=opts.curve||'balanced';
  const outLine=[...line];
  const outLengths=[...lengths];
  for(let i=0;i<outLine.length;i++){
    if(!active[i])continue;
    const local=i%16;
    const anchor=local===0||local===8;
    const halfCadence=local===4||local===12;
    const shouldChord = anchor ? rnd()<chordChance*(sectionName==='drop'?1.1:sectionName==='break'?0.72:1) : halfCadence && rnd()<chordChance*0.38;
    if(shouldChord && !Array.isArray(outLine[i])){
      const style = curve==='glass'?'open':curve==='bloom'?'seventh':sectionName==='cinematic'?'open':'triad';
      outLine[i]=getSynthChordVoicing(outLine[i],pool,sectionName,style);
    }
    const baseLen=outLengths[i]||1;
    let holdMult = 1 + holdAmt*(anchor?2.8:halfCadence?1.6:0.7);
    if(curve==='snappy')holdMult*=anchor?1.2:0.72;
    if(curve==='soft')holdMult*=1.28;
    if(curve==='bloom')holdMult*=1.62;
    if(curve==='glass')holdMult*=1.08;
    if(sectionName==='break'||sectionName==='cinematic')holdMult*=1.22;
    if(anchor||halfCadence)outLengths[i]=Math.min(16,Math.max(baseLen,baseLen*holdMult));
  }
  return {line:outLine,lengths:outLengths};
}


const NOTE_ROLE={DL:'landing',DA:'approach',DE:'extension',BL:'bridge',BA:'breakAccent',BE:'breakExtension'};

function chooseNoteRole({lane='synth',sectionName='groove',local=0,functionType='tonic',energy=0.6,triggerState=null}){
  const anchor=local%8===0;
  const half=local%8===4;
  if(triggerState?.sectionOverstay&&anchor)return 'BA';
  if(triggerState?.hookFound&&anchor)return 'DL';
  if(sectionName==='fill')return local>=12?'BE':'BA';
  if(sectionName==='break')return anchor?'BL':'DE';
  if(functionType==='dominant'&&half)return 'DA';
  if(functionType==='predominant'&&!anchor)return 'BL';
  if(anchor)return energy>0.78&&lane==='synth'?'BA':'DL';
  if(half)return 'DA';
  return rnd()<(lane==='bass'?0.18:0.28)?'DE':'BL';
}

function applyNoteRole(note, role, context){
  const {pool,chordPool,lane='synth',sectionName='groove',targetNote=null,previousNote=null,energy=0.6}=context;
  if(!note)return targetNote||previousNote||pool[0];
  const stable=(chordPool&&chordPool.length)?chordPool:[pool[0]];
  switch(role){
    case 'DL':
      return chooseTargetTone(stable,pool,lane,sectionName,classifyChordFunction(context.chord,pool),energy,previousNote||note);
    case 'DA':
      return choosePassingTone(previousNote||note,targetNote||chooseTargetTone(stable,pool,lane,sectionName,classifyChordFunction(context.chord,pool),energy,previousNote||note),pool,lane,energy);
    case 'DE': {
      const idx=noteIndexSafe(pool,note);
      const ext=pool[clamp(idx+(lane==='bass'?1:2),0,pool.length-1)]||note;
      return nearestPoolNote(ext,pool,[...stable,ext]);
    }
    case 'BL':
      return nearestPoolNote(previousNote||note,pool,[...(stable||[]),note]);
    case 'BA':
      return voiceLead(nearestPoolNote(note,pool,[...(stable||[]),note]),pool);
    case 'BE': {
      const tgt=targetNote||chooseTargetTone(stable,pool,lane,sectionName,classifyChordFunction(context.chord,pool),energy,previousNote||note);
      return choosePassingTone(note,tgt,pool,lane,Math.max(0.2,energy-0.12));
    }
    default:return note;
  }
}

function evaluateCompositionTriggers(memory,sectionName,macroEnergy,genre){
  const fam=getGenreFamilyProfile(genre);
  const repetition=detectRepetition(memory,sectionName);
  const lowContrast=detectLowContrast(memory);
  const energyStall=detectEnergyStall(memory,macroEnergy);
  const hookFound=detectHook(memory,sectionName);
  const sectionOverstay=detectSectionFatigue(memory,sectionName);
  return {
    repetition,
    lowContrast,
    energyStall,
    hookFound,
    sectionOverstay,
    genreWeight:fam.hookBias,
    transformBias:clamp((lowContrast?0.2:0)+(energyStall?0.18:0)+(repetition?0.12:0)+fam.motion*0.8,0.08,0.62),
    sustainBias:clamp((sectionName==='cinematic'||sectionName==='break'?0.22:0)+(hookFound?0.08:0)+Math.max(0,0.46-macroEnergy)*0.35,0,0.5),
    contrastBias:clamp((sectionOverstay?0.22:0)+(lowContrast?0.16:0)+fam.accent*0.5,0,0.5),
  };
}

function applyTriggerResponse({rhythm,lane,sectionName,triggerState,macroEnergy}){
  let out=[...rhythm];
  if(triggerState.repetition && lane==='synth' && sectionName!=='break') out=Array.from(new Set([...out,14])).sort((a,b)=>a-b);
  if(triggerState.lowContrast && lane==='hat') out=out.filter((p,i)=>i%2===0||p>=8);
  if(triggerState.energyStall && lane==='bass' && sectionName!=='break') out=Array.from(new Set([...out,12])).sort((a,b)=>a-b);
  if(triggerState.sectionOverstay && lane!=='kick') out=out.filter(p=>p<15);
  if(triggerState.hookFound && lane==='synth' && macroEnergy>0.72) out=Array.from(new Set([...out,2,10])).sort((a,b)=>a-b);
  return out;
}

function detectRepetition(memory, sectionName){
  const recent=(memory?.recentSections||[]).slice(-4);
  return recent.length>=3 && recent.every(v=>v===recent[0]) || recent.filter(v=>v===sectionName).length>=3;
}

function detectLowContrast(memory){
  const energies=(memory?.energyHistory||[]).slice(-4).map(e=>typeof e==='number'?e:e?.energy).filter(v=>typeof v==='number');
  if(energies.length<3)return false;
  return (Math.max(...energies)-Math.min(...energies))<0.07;
}

function detectEnergyStall(memory, macroEnergy){
  const energies=(memory?.energyHistory||[]).slice(-4);
  if(energies.length<3)return false;
  const spread=Math.max(...energies)-Math.min(...energies);
  return macroEnergy<0.82 && spread<0.05;
}

function detectHook(memory, sectionName){
  return !!(memory?.lastStrongHook && (sectionName==='drop'||sectionName==='groove'||sectionName==='build'||sectionName==='tension'));
}

function detectSectionFatigue(memory, sectionName){
  const recent=(memory?.recentSections||[]).slice(-5);
  return recent.length>=4 && recent.filter(v=>v===sectionName).length>=3;
}


function resolveTriggerConsequences(triggerState, sectionName, lane, genre, macroEnergy){
  const fam=getGenreFamilyProfile(genre);
  return {
    motifFocus: !!(triggerState.hookFound || (sectionName==='drop'&&macroEnergy>0.74)),
    sustainBoost: clamp((triggerState.sustainBias||0)+(sectionName==='cinematic'?0.18:0)+(lane==='synth'&&triggerState.sectionOverstay?0.08:0),0,0.72),
    rhythmMutation: clamp((triggerState.transformBias||0)+(lane==='hat'&&triggerState.lowContrast?0.14:0)+(lane==='bass'&&triggerState.energyStall?0.1:0),0.06,0.86),
    removeDensity: !!(triggerState.lowContrast && (sectionName==='break'||sectionName==='outro')),
    forceAccent: !!(triggerState.repetition && (lane==='kick'||lane==='snare')),
    chordBloom: !!(lane==='synth' && (sectionName==='cinematic'||triggerState.hookFound||triggerState.sectionOverstay) && fam.synthRole!=='shard'),
    bassAnchor: !!(lane==='bass' && (triggerState.energyStall || fam.bassRole==='pedal' || sectionName==='cinematic')),
  };
}

function chooseMotifTransform({lane='synth',sectionName='groove',triggerState={},isAnswer=false,isRecall=false,deepRecall=false,macroEnergy=0.6,phraseIndex=0}){
  if(deepRecall && sectionName==='drop')return 'hookFocus';
  if(triggerState.hookFound && lane==='synth' && phraseIndex%2===0)return 'preserve';
  if(triggerState.sectionOverstay && lane==='synth')return phraseIndex%2===0?'displace':'fragment';
  if(triggerState.lowContrast && lane==='synth')return phraseIndex%2===0?'lift':'invert';
  if(triggerState.lowContrast && lane==='bass')return 'anchor';
  if(triggerState.energyStall && lane==='bass')return 'anchor';
  if(sectionName==='fill')return 'fragment';
  if(isAnswer)return lane==='bass'?'stepAnswer':'answer';
  if(isRecall)return phraseIndex%2===0?'preserve':'stretch';
  if(sectionName==='break')return lane==='synth'?'stretch':'sparse';
  if(macroEnergy>0.84 && lane==='synth')return 'push';
  return 'drift';
}

function transformMotif(sourceMotif,pool,mode='preserve',intensity=0.18,context={}){
  const src=Array.isArray(sourceMotif)?sourceMotif.slice():[];
  if(!src.length)return src;
  const pivot=src.find(Boolean)||pool[0];
  const pivotIdx=noteIndexSafe(pool,pivot);
  return src.map((note,idx)=>{
    if(note===null)return null;
    const nIdx=noteIndexSafe(pool,note);
    switch(mode){
      case 'preserve':
      case 'hookFocus':
        return idx===0&&mode==='hookFocus'?nearestPoolNote(note,pool,[pivot,note]):note;
      case 'answer':
        return idx%2===0?voiceLead(note,pool):nearestPoolNote(note,pool,[pool[Math.max(0,nIdx-1)],pool[Math.min(pool.length-1,nIdx+1)]]);
      case 'stepAnswer':
        return nearestPoolNote(note,pool,[pool[Math.max(0,nIdx-1)],pool[Math.min(pool.length-1,nIdx+1)],pivot]);
      case 'lift':
        return pool[Math.min(pool.length-1,nIdx+(idx%3===0?2:1))]||note;
      case 'invert': {
        const offset=nIdx-pivotIdx;
        return pool[clamp(pivotIdx-offset,0,pool.length-1)]||note;
      }
      case 'stretch':
        return idx%2===0?note:(pool[Math.min(pool.length-1,nIdx+1)]||note);
      case 'fragment':
        return idx>=Math.ceil(src.length*(0.5+intensity*0.3))?null:note;
      case 'sparse':
        return idx%3===1?null:note;
      case 'push':
        return idx===src.length-1?voiceLead(note,pool):(rnd()<0.18+intensity*0.18?voiceLead(note,pool):note);
      case 'anchor':
        return idx===0||idx===src.length-1?nearestPoolNote(note,pool,[pivot,pool[pivotIdx],pool[Math.max(0,pivotIdx-2)]]):note;
      case 'displace':
        return src[(idx+1)%src.length]??note;
      case 'drift':
      default:
        return rnd()<intensity?voiceLead(note,pool):note;
    }
  });
}

function classifyPhrase(notes, active, lane='synth', sectionName='groove'){
  const seq=(notes||[]).filter(Boolean);
  if(seq.length<2)return 'filler';
  const uniq=new Set(seq).size;
  const act=(active||[]).filter(Boolean).length;
  if((sectionName==='drop'||sectionName==='groove') && uniq>=3 && act>=Math.max(3,Math.floor((notes||[]).length*0.45)))return 'primary';
  if(sectionName==='break' || act<=2)return 'bridge';
  if(lane==='bass' && uniq<=2)return 'pedal';
  return 'secondary';
}

function chooseChordVoicing(baseNote,pool,spread=1,sectionName='groove',energy=0.6){
  const idx=noteIndexSafe(pool,baseNote);
  const third=pool[Math.min(pool.length-1,idx+2)]||baseNote;
  const fifth=pool[Math.min(pool.length-1,idx+4)]||third;
  const top=pool[Math.min(pool.length-1,idx+(sectionName==='cinematic'||energy<0.34?7:6))]||fifth;
  if(sectionName==='break' || sectionName==='outro')return [baseNote,third];
  if(sectionName==='cinematic' || energy<0.36)return [baseNote,fifth,top];
  if(spread>0.72)return [baseNote,third,fifth,top];
  return [baseNote,third,fifth];
}

// ─── MELODIC PHRASE BUILDER ───────────────────────────────────────────────────
// Creates motif/reply phrases with recall, section energy and controlled mutation
function buildMelodicLine(pool, chordProgression, steps, chaos, arpeMode, lenBias, options={}){
  const {lane='bass',sectionName='groove',blueprint=null,cycleIndex=0}=options;
  const line=mkNotes(pool[0]);
  const lengths=Array(steps).fill(1);
  const active=Array(steps).fill(false);
  const phraseLen=16;
  const phraseCount=Math.max(1,Math.ceil(steps/phraseLen));
  const energy=sectionEnergy(sectionName);
  const memory=blueprint?.memory;
  const motifKey=lane==='bass'?'bassMotif':'synthMotif';
  const tailKey=lane==='bass'?'previousBassTail':'previousSynthTail';
  const rhythmSource=lane==='bass'?(blueprint?.bassRhythm||[0,4,8,12]):(blueprint?.synthRhythm||[2,6,10,14]);
  const firstChord=chordProgression[0];
  const firstNotes=chordNotes(firstChord,pool);
  let current=(memory&&memory[tailKey])||firstNotes[0]||pool[0];
  const laneHooks=memory?.laneHooks?.[lane]||[];
  const longHook=(laneHooks[0]?.notes)||memory?.lastStrongHook?.notes||null;
  const primaryMotif=(blueprint?.primaryMotifs?.[lane])||null;
  const hookRecallWeight=getHookRecallWeight(sectionName, blueprint?.genre||'acid');
  const triggerState=evaluateCompositionTriggers(memory,sectionName,energy,blueprint?.genre||'acid');
  const consequences=resolveTriggerConsequences(triggerState,sectionName,lane,blueprint?.genre||'acid',energy);

  const motif=((memory&&Array.isArray(memory[motifKey])?memory[motifKey]:null) || (consequences.motifFocus&&primaryMotif?primaryMotif:null) || (longHook&&rnd()<hookRecallWeight?longHook:null)) || Array.from({length:8},(_,idx)=>{
    if(idx>0&&rnd()<(lane==='bass'?0.12:0.18))return null;
    const stepHint=(blueprint?.contour?.[idx]??0)+(lane==='synth'&&idx%3===2?(blueprint?.hookShift||0):0);
    const note=motifStepToNote(stepHint,firstNotes,pool,current);
    current=note||current;
    return note;
  });

  if(memory&&!memory[motifKey])memory[motifKey]=[...motif];

  for(let phrase=0;phrase<phraseCount;phrase++){
    const phraseStart=phrase*phraseLen;
    const isAnswer=phrase%2===1;
    const isRecall=phrase>1&&rnd()<(blueprint?.repetitionBias??0.62);
    const deepRecall=longHook&&phrase>0&&rnd()<hookRecallWeight*(phrase%2===0?0.72:0.44);
    const mutateAmt=clamp((blueprint?.mutationBias??0.18)+chaos*0.16+(sectionName==='tension'?0.08:0)+(consequences.rhythmMutation||0)*0.12,0.08,0.54);
    const rhythm=applyTriggerResponse({
      rhythm:evolveRhythm(rhythmSource,lane,sectionName,chaos,cycleIndex+phrase),
      lane,sectionName,triggerState,macroEnergy:energy
    });
    const sourceMotif=consequences.motifFocus&&Array.isArray(primaryMotif)?primaryMotif:(deepRecall&&Array.isArray(longHook)?longHook:motif);
    const transformMode=chooseMotifTransform({lane,sectionName,triggerState,isAnswer,isRecall,deepRecall,macroEnergy:energy,phraseIndex:phrase});
    const phraseMotif=transformMotif(sourceMotif,pool,transformMode,mutateAmt,{lane,sectionName,phraseIndex:phrase,energy});

    for(let local=0;local<phraseLen&&phraseStart+local<steps;local++){
      const abs=phraseStart+local;
      const chordIndex=Math.floor(abs/Math.max(1,Math.floor(steps/chordProgression.length)))%chordProgression.length;
      const chordPool=chordNotes(chordProgression[chordIndex],pool);
      const on=rhythm.includes(local%16)&&!(sectionName==='break'&&lane==='bass'&&local%16===12&&rnd()<0.6);
      active[abs]=on;
      const motifSlot=Math.floor(local/2)%phraseMotif.length;
      const motifNote=phraseMotif[motifSlot];
      const anchor=local%8===0;

      const functionType=classifyChordFunction(chordProgression[chordIndex],pool);
      const prevNote=line[Math.max(0,abs-1)]||current||pool[0];
      let note=motifNote;
      if(note===null&&on){
        note=chooseTargetTone(chordPool,pool,lane,sectionName,functionType,energy,prevNote);
        if(lane==='synth'&&rnd()<0.22)note=nearestPoolNote(arp(chordPool.length?chordPool:pool,arpeMode,local+cycleIndex),pool,chordPool);
      }

      if(note!==null){
        const preferredTargets = lane==='bass'
          ? [chordPool[0],chordPool[2],prevNote]
          : [chordPool[1],chordPool[0],chordPool[2],prevNote];
        const nearest=nearestPoolNote(note,pool,preferredTargets);
        if(on)note=nearest;
      }else{
        note=prevNote;
      }
      if(on){
        const role=chooseNoteRole({lane,sectionName,local,functionType,energy,triggerState});
        const targetTone=chooseTargetTone(chordPool,pool,lane,sectionName,functionType,energy,prevNote);
        note=applyNoteRole(note,role,{pool,chordPool,lane,sectionName,targetNote:targetTone,previousNote:prevNote,energy,chord:chordProgression[chordIndex]});
      }

      const cadencePoint = local%16===14 || local%16===15;
      if(on && !anchor && cadencePoint && rnd()<(lane==='synth'?0.42:0.28)){
        const targetTone=chooseTargetTone(chordPool,pool,lane,sectionName,functionType,energy,prevNote);
        note=choosePassingTone(prevNote,targetTone,pool,lane,energy);
      }
      if(on && local%16===7 && lane==='synth' && rnd()<0.24){
        const targetTone=chooseTargetTone(chordPool,pool,lane,sectionName,functionType,energy,prevNote);
        note=choosePassingTone(prevNote,targetTone,pool,lane,energy);
      }

      if(anchor&&lane==='bass'&&rnd()<0.76)note=chooseTargetTone(chordPool,pool,lane,sectionName,functionType,energy,prevNote)||note;
      if(anchor&&lane==='synth'&&sectionName!=='break'&&rnd()<0.36)note=chooseTargetTone(chordPool,pool,lane,sectionName,functionType,energy,prevNote)||note;
      if(sectionName==='drop'&&lane==='bass'&&local%16===0&&rnd()<0.4)note=nearestPoolNote(chordPool[0]||note,pool,[chordPool[0],chordPool[2]]);

      line[abs]=note;
      current=note||current;
      lengths[abs]=chooseLength(sectionName,lane,lenBias*(1+(triggerState?.sustainBias||0)+(consequences?.sustainBoost||0)),local,energy);
      if(on&&local%16===15&&sectionName!=='fill'&&rnd()<0.38)lengths[abs]=Math.min(12,lengths[abs]+1.5+(triggerState?.sustainBias||0)*2.2);
      if(on&&lane==='synth'&&local%8===0&&((transformMode==='hookFocus')||triggerState?.hookFound)&&rnd()<0.52)lengths[abs]=Math.min(16,lengths[abs]+2.5);
    }
  }

  const sectionsHistory=memory?.recentSections||[];
  const recallTail=(lane==='bass'?line[Math.max(0,steps-4)]:line[Math.max(0,steps-2)])||current;
  if(memory){
    memory[tailKey]=recallTail;
    memory.recentSections=[...sectionsHistory.slice(-5),sectionName];
    const history=memory.sectionHistory||[];
    const phraseType=classifyPhrase(line.slice(0,Math.min(16,steps)),active.slice(0,Math.min(16,steps)),lane,sectionName);
    memory.sectionHistory=[...history.slice(-11),{lane,section:sectionName,tail:recallTail,cycleIndex,phraseType}];
    memory.phraseMemory={...(memory.phraseMemory||{}),[lane]:[...((memory.phraseMemory&&memory.phraseMemory[lane])||[]).slice(-5),{section:sectionName,phraseType,tail:recallTail}]};
    if(steps>=16){
      const candidates=extractHookCandidates(line,active,lane,pool,sectionName);
      if(candidates.length){
        const best=candidates[0];
        memory.hooks=[...(memory.hooks||[]).slice(-5),best.notes];
        const prevLaneHooks=((memory.laneHooks&&memory.laneHooks[lane])||[]).slice();
        const ranked=[best,...prevLaneHooks].sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,4);
        memory.laneHooks={...(memory.laneHooks||{}),[lane]:ranked};
        if(phraseType==='primary'){
          memory.primaryHooks={...(memory.primaryHooks||{}),[lane]:best};
        }
        if(!memory.lastStrongHook || best.score>=memory.lastStrongHook.score-0.08)memory.lastStrongHook={...best,lane,section:sectionName,phraseType};
      }
    }
  }

  for(let i=steps;i<MAX_STEPS;i++){
    line[i]=line[i%Math.max(1,steps)];
  }

  return{line,lengths,active,motif:[...motif]};
}


function buildSection(genre, sectionName, modeName, progression, arpeMode, prevBass, blueprint=null, cycleIndex=0){
  const sec = SECTIONS[sectionName] || SECTIONS.groove;
  const gd = GENRES[genre];
  const grooveName = gd.density > 0.65 && gd.chaos > 0.4 ? 'bunker' : gd.chaos > 0.6 ? 'broken' : gd.density < 0.4 ? 'float' : 'steady';
  const groove = GROOVE_MAPS[grooveName];
  const mode = MODES[modeName] || MODES.minor;
  const bp = mode.b, sp = mode.s;
  const laneLen = {kick:16, snare:16, hat:32, bass:32, synth:32};
  if(genre === 'dnb'){laneLen.hat = 48; laneLen.bass = 32; laneLen.synth = 64;}
  if(genre === 'cinematic'){laneLen.kick = 32; laneLen.bass = 64; laneLen.synth = 64;}
  if(genre === 'acid'){laneLen.bass = 16; laneLen.synth = 32;}
  if(genre === 'cinematic'){laneLen.bass = 64; laneLen.synth = 64;}

  const density = gd.density, chaos = gd.chaos;
  const soundCharacter = blueprint?.soundCharacter || getGenreSoundCharacter(genre);
  const charCfg = mergeCharacterAndGenre(soundCharacter, genre);
  const genreFamily = blueprint?.genreFamily || getGenreFamilyProfile(genre);
  const fillMode = chooseTransitionFillMode(sectionName, blueprint?.memory, genre);
  const sectionVisits = blueprint?.memory?.sectionVisits || {};
  const visitCount = sectionVisits[sectionName] || 0;
  if(blueprint?.memory)blueprint.memory.sectionVisits[sectionName] = visitCount + 1;
  const macroEnergy = computeMacroEnergy(sectionName, blueprint, cycleIndex, visitCount);
  const triggerState = evaluateCompositionTriggers(blueprint?.memory, sectionName, macroEnergy, genre);
  const structuredBars = createStructuredBarProfile(sectionName, Math.max(1, Math.ceil(Math.max(laneLen.kick,laneLen.snare,laneLen.hat,laneLen.bass,laneLen.synth)/16)), visitCount, cycleIndex, macroEnergy, soundCharacter);
  const synthConsequences = resolveTriggerConsequences(triggerState, sectionName, 'synth', genre, macroEnergy);
  const bassConsequences = resolveTriggerConsequences(triggerState, sectionName, 'bass', genre, macroEnergy);
  if(blueprint?.memory){
    const eh=blueprint.memory.energyHistory||[];
    blueprint.memory.energyHistory=[...eh.slice(-11),{section:sectionName,energy:macroEnergy,fillMode,cycleIndex}];
    const cadence=blueprint.memory.cadenceBySection||{};
    blueprint.memory.cadenceBySection={...cadence,[sectionName]:{energy:macroEnergy,fillMode,visit:visitCount+1}};
  }

  const bassRoleBias = genreFamily.bassRole==='drone'?1.4:genreFamily.bassRole==='lead'?0.72:genreFamily.bassRole==='pulse'?0.88:genreFamily.bassRole==='pressure'?0.8:genreFamily.bassRole==='pedal'?1.55:1;
  const synthRoleBias = genreFamily.synthRole==='wash'?2.2:genreFamily.synthRole==='theme'?1.7:genreFamily.synthRole==='chord'?1.45:genreFamily.synthRole==='stab'?0.9:genreFamily.synthRole==='shard'?0.86:1.2;
  const bassLb = sec.lb * (sectionName === 'break' ? 2.5 : sectionName === 'drop' ? 0.8 : 1) * (0.94 + macroEnergy * 0.12) * bassRoleBias * (bassConsequences.bassAnchor?1.32:1);
  const synthLb = sec.lb * (sectionName === 'break' ? 3 : genre === 'cinematic' ? 4 : 1.2) * (0.92 + macroEnergy * 0.14) * synthRoleBias * (synthConsequences.chordBloom?1.28:1);
  const bassBuilt = buildMelodicLine(bp, progression, laneLen.bass, chaos, arpeMode, bassLb, {lane:'bass', sectionName, blueprint, cycleIndex:cycleIndex+visitCount});
  const synthBuilt = buildMelodicLine(sp, progression, laneLen.synth, chaos * 0.72, arpeMode, synthLb, {lane:'synth', sectionName, blueprint, cycleIndex:cycleIndex+visitCount});
  const {line: bassLine, lengths: bassLengths, active: bassActive} = bassBuilt;
  let {line: synthLine, lengths: synthLengths, active: synthActive} = synthBuilt;
  const synthFamilyCfg=getSoundFamilyConfig('synth', blueprint?.soundFamilies?.synth||getGenreSoundFamilies(genre).synth);
  const synthExpression = applySynthExpression(synthLine, synthLengths, synthActive, sp, sectionName, {
    chordChance: clamp((typeof globalThis!=='undefined' && typeof globalThis.__CESIRA_SYNTH_CHORD_CHANCE__==='number' ? globalThis.__CESIRA_SYNTH_CHORD_CHANCE__ : 0.34)+(synthConsequences.chordBloom?0.18:0)+(synthFamilyCfg.chord||0),0.08,0.92),
    holdAmt: clamp((typeof globalThis!=='undefined' && typeof globalThis.__CESIRA_SYNTH_HOLD__==='number' ? globalThis.__CESIRA_SYNTH_HOLD__ : 0.56)+(synthConsequences.sustainBoost||0)*0.8,0.1,1),
    curve: typeof globalThis!=='undefined' && globalThis.__CESIRA_SYNTH_CURVE__ ? globalThis.__CESIRA_SYNTH_CURVE__ : 'balanced',
  });
  synthLine = synthExpression.line;
  synthLengths = synthExpression.lengths;
  if(prevBass && bassLine.length)bassLine[0] = voiceLead(prevBass, [bassLine[0], ...(chordNotes(progression[0], bp))].filter(Boolean));

  const p = {kick:mkSteps(), snare:mkSteps(), hat:mkSteps(), bass:mkSteps(), synth:mkSteps()};
  const bar = 16;
  const phraseW = [1, 0.78, 0.94, 0.7];
  const sectionE = sectionEnergy(sectionName);

  for(const lane of ['kick','snare','hat','bass','synth']){
    const ll = laneLen[lane];
    const lmKey = lane === 'kick' ? 'kM' : lane === 'snare' ? 'sM' : lane === 'hat' ? 'hM' : lane === 'bass' ? 'bM' : 'syM';
    const lm = sec[lmKey] || 1;
    const familyLift = 1 + (lane==='bass'?genreFamily.motion*0.18:lane==='synth'?genreFamily.hookBias*0.06:genreFamily.accent*0.12);
    const laneConsequences = resolveTriggerConsequences(triggerState, sectionName, lane, genre, macroEnergy);
    const dm = density * lm * (0.92 + macroEnergy * 0.16) * (1 + charCfg.motionBias * 0.08) * familyLift * (laneConsequences.removeDensity?0.82:1) * (laneConsequences.forceAccent?1.06:1);
    const maxDensity = (lane === 'bass' ? 0.72 : lane === 'synth' ? 0.58 : 1.0) * clamp(0.94 + macroEnergy * 0.1 + charCfg.accentBias * 0.04 + genreFamily.accent * 0.08,0.84,1.14);
    const totalBars = Math.max(1, Math.ceil(ll / 16));

    for(let i = 0; i < ll; i++){
      const pos = i % bar;
      const pb = Math.floor(i / 8) % 4;
      const barIndex = Math.floor(i / 16);
      const barPhase = totalBars <= 1 ? 1 : barIndex / (totalBars - 1);
      const strong = pos === 0 || pos === 8;
      const backbeat = pos === 4 || pos === 12;
      const offbeat = pos % 2 === 1;
      const endOfBar = pos >= 12;
      const sectionShape = structuredBars[Math.min(structuredBars.length-1,barIndex)] || 1;
      const energyLift = 0.82 + macroEnergy * 0.32;
      const pw = phraseW[pb] * sectionShape * energyLift * (sectionName === 'build' ? 0.82 + barPhase * 0.34 : sectionName === 'outro' ? 1.06 - barPhase * 0.24 : 1);
      let hit = false;

      if(lane === 'kick'){
        if(gd.kick === 'every4') hit = pos % 4 === 0 || (sectionName === 'fill' && pos === 14);
        else if(gd.kick === 'syncopated') hit = pos === 0 || pos === 10 || pos === 14 || (sectionName === 'drop' && pos === 6);
        else if(gd.kick === 'sparse') hit = pos === 0 || (sectionName === 'build' && pos === 12);
        else if(gd.kick === 'irregular') hit = pos === 0 || rnd() < dm * 0.28 * pw;
        else hit = strong || rnd() < (groove.kB + dm * 0.16 + (endOfBar && sectionName === 'fill' ? 0.2 : 0)) * pw;
        if(sectionName === 'break') hit = hit && (pos === 0 || pos === 12);
        if(sectionName === 'build' && barPhase > 0.5 && (pos === 12 || pos === 14)) hit = true;
        if(triggerState.energyStall && pos===8) hit = true;
      }
      else if(lane === 'snare'){
        if(gd.hatPattern === 'breakbeat') hit = backbeat || rnd() < (groove.sB + dm * 0.12) * (1 + pb * 0.18);
        else hit = backbeat || rnd() < (groove.sB + dm * 0.06 + (backbeat ? 0.24 : 0)) * (1.02 - pw * 0.14);
        if(sectionName === 'fill' && pos >= 12) hit = fillMode==='air-gap'?pos===12||pos===14:fillMode==='break-rush'?pos!==15:(pos !== 15);
        if(sectionName === 'intro') hit = hit && (pos === 12 || (barIndex % 2 === 1 && pos === 4));
      }
      else if(lane === 'hat'){
        const hatP = gd.hatPattern;
        if(hatP === '16th') hit = true;
        else if(hatP === 'offbeat') hit = offbeat;
        else if(hatP === 'breakbeat') hit = rnd() < (groove.hB + dm * 0.22) * (0.8 + pw * 0.25);
        else if(hatP === 'noise') hit = rnd() < 0.55 + dm * 0.18;
        else if(hatP === 'sparse') hit = rnd() < 0.2 + dm * 0.1;
        else hit = rnd() < (groove.hB + dm * 0.18) * (0.82 + pw * 0.22);
        if(sectionName === 'break') hit = hit && (pos % 4 === 2);
        if(sectionName === 'build' && endOfBar) hit = true;
        if(sectionName === 'fill' && fillMode==='re-entry') hit = hit || pos===10 || pos===15;
        if(sectionName === 'fill' && fillMode==='air-gap') hit = hit && (pos===6 || pos===10 || pos===14);
        if(hit && rnd() < chaos * 0.3) p.hat[i].p = 0.45 + rnd() * 0.4;
      }
      else if(lane === 'bass'){
        const anchorBoost = strong || pos === 4 || pos === 12;
        const melodicGate = !!bassActive[i];
        const prob = anchorBoost ? 0.86 * lm : (groove.bB + dm * 0.1 + sectionE * 0.06) * pw * 0.68;
        hit = melodicGate && rnd() < Math.min(prob, maxDensity);
        if(sectionName === 'drop' && anchorBoost) hit = true;
        if(sectionName === 'break' && genreFamily.bassRole==='pedal') hit = hit && (pos===0||pos===8);
      }
      else if(lane === 'synth'){
        const phraseOn = pos === 2 || pos === 6 || pos === 10 || pos === 14;
        const melodicGate = !!synthActive[i];
        const prob = phraseOn ? 0.68 * lm : (groove.syB + dm * 0.07 + sectionE * 0.05) * pw * 0.52;
        hit = melodicGate && ((rnd() < Math.min(prob, maxDensity) && !strong) || (pb === 3 && rnd() < 0.18 + chaos * 0.15));
        if(sectionName === 'break') hit = melodicGate && (phraseOn || pos === 0);
        if(triggerState.hookFound && (pos===2||pos===10)) hit = true;
        if(sectionName === 'drop' && blueprint?.memory?.lastStrongHook?.lane==='synth' && (pos===2||pos===10)) hit = true;
      }

      if(hit){
        p[lane][i].on = true;
        p[lane][i].p = clamp(sec.pb + rnd() * (1 - sec.pb), sec.pb, 1);
        const fillVelocityBias = sectionName==='fill' ? (fillMode==='impact'||fillMode==='re-entry'?1.12:fillMode==='air-gap'?0.84:fillMode==='break-rush'?1.08:1) : 1;
        p[lane][i].v = clamp(velCurve(sec.vel, i, ll, pw) * (sectionName==='build' ? 0.88 + barPhase * 0.18 : 1) * fillVelocityBias * (0.94 + macroEnergy * 0.12 + charCfg.accentBias * 0.08 + genreFamily.accent * 0.06), 0.22, 1);
        if(lane === 'bass') p[lane][i].l = bassLengths[i] || sec.lb;
        else if(lane === 'synth') p[lane][i].l = synthLengths[i] || sec.lb;
        else p[lane][i].l = 1;
      }
    }
  }

  for(let i = 0; i < laneLen.kick; i += 16) p.kick[i].on = true;
  if(gd.kick !== 'sparse' && sectionName !== 'break'){
    for(let i = 0; i < laneLen.snare; i += 16){
      if(i + 4 < laneLen.snare) p.snare[i + 4].on = true;
      if(i + 12 < laneLen.snare) p.snare[i + 12].on = true;
    }
  }
  if(sectionName === 'fill'){
    const ll = laneLen.snare;
    for(let i = 0; i < ll; i++){
      const pos=i%16;
      if(fillMode==='air-gap') p.snare[i].on = pos===12 || pos===14;
      else if(fillMode==='break-rush') p.snare[i].on = pos>=10 && pos!==13;
      else if(fillMode==='re-entry') p.snare[i].on = pos===8 || pos===10 || pos===12 || pos===15;
      else if(pos>=12) p.snare[i].on = true;
    }
    if(fillMode==='lift'){
      for(let i=0;i<laneLen.hat;i++) if(i%16>=8) p.hat[i].on = true;
    }
  }

  for(const lane of ['bass', 'synth']){
    const ll = laneLen[lane];
    for(let i = 0; i < ll; i++){
      if(p[lane][i].on && p[lane][i].l > 1){
        const holdEnd = Math.min(ll - 1, i + Math.floor(p[lane][i].l));
        for(let j = i + 1; j <= holdEnd; j++){
          p[lane][j].tied = true;
          p[lane][j].on = false;
        }
      }
    }
  }

  const mp = Math.floor(chaos * 4);
  for(let m = 0; m < mp; m++){
    const ln = pick(['kick','snare','hat']);
    const ll = laneLen[ln];
    const pos = Math.floor(rnd() * ll);
    if(ln === 'hat') p.hat[pos].on = !p.hat[pos].on;
    else if(ln === 'kick'){if(pos % 4 !== 0) p.kick[pos].on = rnd() < 0.28 + chaos * 0.16;}
    else{p.snare[pos].on = !p.snare[pos].on && pos % 4 !== 0;}
  }

  const lb = bassLine[Math.max(0,laneLen.bass - 1)] || bp[0];
  return {patterns:p, bassLine, synthLine, laneLen, lastBass:lb, macroEnergy, soundCharacter};
}

function buildSong(genre){
  const gd=GENRES[genre];
  const modeName=pick(gd.modes);
  const progPool=CHORD_PROGS[modeName]||CHORD_PROGS.minor;
  const progression=pick(progPool);
  const arpeMode=pick(['up','down','updown','outside']);
  const bpm=Math.round(gd.bpm[0]+rnd()*(gd.bpm[1]-gd.bpm[0]));
  const arc=pick(SONG_ARCS);
  const composition=createCompositionBlueprint(genre,modeName,progression,arpeMode);
  const soundCharacter=composition.soundCharacter;
  const genreFamily=composition.genreFamily;
  const sections=arc.map((name,idx)=>({
    name,
    modeName,
    progression,
    arpeMode,
    genre,
    energy:sectionEnergy(name),
    soundCharacter,
    genreFamily,
    order:idx,
  }));
  return{genre,modeName,progression,arpeMode,bpm,arc,sections,currentSection:0,composition,soundCharacter,genreFamily};
}

// ─── GROOVE ACCENT TABLE ──────────────────────────────────────────────────────
function grooveAccent(profile,lane,step,amount){
  const pos=step%16;
  const T={
    steady:{kick:[1.2,1,0.92,0.96,1,0.94,0.98,0.96,1.18,0.98,0.92,0.96,1.02,0.96,0.98,0.96],snare:[0.92,0.9,0.92,0.9,1.16,0.92,0.92,0.9,0.92,0.9,0.92,0.9,1.12,0.92,0.92,0.9],hat:[0.92,1.02,0.9,1.04,0.94,1.02,0.9,1.06,0.92,1.02,0.9,1.04,0.94,1.02,0.9,1.08],bass:[1.1,0.96,0.98,1.02,0.96,0.94,1,1.04,1.08,0.96,0.98,1.02,0.96,0.94,1,1.04],synth:[0.96,1,1.04,1,0.96,1,1.08,1,0.96,1,1.04,1,0.96,1,1.12,1]},
    broken:{kick:[1.22,0.88,1.04,0.84,0.96,1.06,0.9,1.02,1.14,0.86,1.08,0.82,0.94,1.04,0.9,1.06],snare:[0.88,0.94,0.9,1,1.12,0.9,0.96,0.9,0.88,1,0.9,0.96,1.1,0.88,1,0.92],hat:[0.84,1.08,0.9,1.14,0.86,1.02,0.92,1.12,0.84,1.08,0.9,1.14,0.86,1.02,0.92,1.16],bass:[1.06,0.94,1.1,0.88,1,0.94,1.08,0.9,1.04,0.94,1.1,0.88,1,0.94,1.08,0.92],synth:[0.92,1.04,1.12,0.9,0.94,1.08,1.14,0.88,0.92,1.04,1.1,0.9,0.94,1.08,1.16,0.86]},
    bunker:{kick:[1.28,0.92,0.94,0.9,1.02,0.92,0.94,0.9,1.24,0.92,0.94,0.9,1.04,0.92,0.94,0.9],snare:[0.9,0.9,0.92,0.9,1.08,0.9,0.92,0.9,0.9,0.9,0.92,0.9,1.06,0.9,0.92,0.9],hat:[0.88,0.98,0.9,1.02,0.88,0.98,0.9,1.04,0.88,0.98,0.9,1.02,0.88,0.98,0.9,1.06],bass:[1.16,0.94,0.96,1,1.04,0.94,0.96,1.02,1.14,0.94,0.96,1,1.06,0.94,0.96,1.04],synth:[0.9,0.98,1.02,0.96,0.9,0.98,1.06,0.96,0.9,0.98,1.02,0.96,0.9,0.98,1.1,0.96]},
    float: {kick:[1.12,0.98,0.96,1,1.04,0.98,0.96,1,1.1,0.98,0.96,1,1.02,0.98,0.96,1],snare:[0.94,0.98,0.96,1,1.06,0.98,0.96,1,0.94,0.98,0.96,1,1.08,0.98,0.96,1],hat:[0.96,1.02,0.98,1.04,0.96,1.02,0.98,1.06,0.96,1.02,0.98,1.04,0.96,1.02,0.98,1.08],bass:[1.04,0.98,1,1.02,1.04,0.98,1,1.04,1.02,0.98,1,1.02,1.06,0.98,1,1.04],synth:[1,1.04,1.08,1.02,1,1.04,1.1,1.02,1,1.04,1.08,1.02,1,1.04,1.12,1.02]},
  };
  const t=(T[profile]||T.steady)[lane]||T.steady.kick;
  return 1+(t[pos]-1)*clamp(amount,0,1);
}

// ─── COLORS & THEME ───────────────────────────────────────────────────────────
const LANE_CLR={kick:'#ff4444',snare:'#ffaa00',hat:'#ffdd00',bass:'#00ccff',synth:'#cc88ff'};
const GENRE_CLR={
  dnb:'#ff4400',acid:'#aaff00',industrial:'#aaaaaa',experimental:'#ff44ff',cinematic:'#4488ff'
};


const SOUND_PRESETS={
  bass:{
    sub_floor:{label:'SUB FLOOR',bassMode:'sub',bassFilter:0.38,bassSubAmt:0.92,drive:0.06,compress:0.24,tone:0.48,bassDetune:0.004,bassMotion:0.18,bassPunch:0.52},
    deep_foundation:{label:'DEEP FOUNDATION',bassMode:'sub',bassFilter:0.32,bassSubAmt:0.98,drive:0.04,compress:0.18,tone:0.42,bassDetune:0.002,bassMotion:0.14,bassPunch:0.44},
    acid_pressure:{label:'ACID PRESSURE',bassMode:'bit',bassFilter:0.72,bassSubAmt:0.36,drive:0.42,compress:0.32,tone:0.42,fmIdx:0.86,bassDetune:0.006,bassMotion:0.58,bassPunch:0.76},
    acid_serpent:{label:'ACID SERPENT',bassMode:'bit',bassFilter:0.78,bassSubAmt:0.28,drive:0.46,compress:0.34,tone:0.38,fmIdx:1.12,bassDetune:0.008,bassMotion:0.66,bassPunch:0.82},
    fm_metal:{label:'FM METAL',bassMode:'fm',bassFilter:0.62,bassSubAmt:0.28,drive:0.26,compress:0.38,tone:0.44,fmIdx:1.08,bassDetune:0.005,bassMotion:0.46,bassPunch:0.68},
    fm_orbit:{label:'FM ORBIT',bassMode:'fm',bassFilter:0.58,bassSubAmt:0.34,drive:0.22,compress:0.3,tone:0.52,fmIdx:0.92,bassDetune:0.007,bassMotion:0.54,bassPunch:0.62},
    drift_drone:{label:'DRIFT DRONE',bassMode:'drone',bassFilter:0.56,bassSubAmt:0.62,drive:0.1,compress:0.18,tone:0.66,bassDetune:0.01,bassMotion:0.8,bassPunch:0.24},
    night_drone:{label:'NIGHT DRONE',bassMode:'drone',bassFilter:0.48,bassSubAmt:0.72,drive:0.08,compress:0.16,tone:0.6,bassDetune:0.012,bassMotion:0.88,bassPunch:0.18},
    fold_grit:{label:'FOLD GRIT',bassMode:'fold',bassFilter:0.68,bassSubAmt:0.34,drive:0.48,compress:0.4,tone:0.36,bassDetune:0.009,bassMotion:0.72,bassPunch:0.86},
    steel_fold:{label:'STEEL FOLD',bassMode:'fold',bassFilter:0.74,bassSubAmt:0.26,drive:0.52,compress:0.42,tone:0.3,bassDetune:0.01,bassMotion:0.76,bassPunch:0.88},
    wet_orbit:{label:'WET ORBIT',bassMode:'wet',bassFilter:0.48,bassSubAmt:0.5,drive:0.22,compress:0.24,tone:0.7,bassDetune:0.006,bassMotion:0.62,bassPunch:0.42},
    vapor_current:{label:'VAPOR CURRENT',bassMode:'wet',bassFilter:0.44,bassSubAmt:0.56,drive:0.18,compress:0.2,tone:0.76,bassDetune:0.008,bassMotion:0.7,bassPunch:0.38},
    pulse_body:{label:'PULSE BODY',bassMode:'pulse',bassFilter:0.58,bassSubAmt:0.44,drive:0.18,compress:0.28,tone:0.56,bassDetune:0.01,bassMotion:0.52,bassPunch:0.64},
    mono_pulse:{label:'MONO PULSE',bassMode:'pulse',bassFilter:0.62,bassSubAmt:0.4,drive:0.22,compress:0.32,tone:0.48,bassDetune:0.014,bassMotion:0.4,bassPunch:0.72},
    saw_motion:{label:'SAW MOTION',bassMode:'saw',bassFilter:0.64,bassSubAmt:0.3,drive:0.3,compress:0.34,tone:0.52,bassDetune:0.012,bassMotion:0.58,bassPunch:0.7},
    reese_engine:{label:'REESE ENGINE',bassMode:'saw',bassFilter:0.54,bassSubAmt:0.36,drive:0.34,compress:0.36,tone:0.46,bassDetune:0.024,bassMotion:0.74,bassPunch:0.74},
  },
  synth:{
    velvet_pad:{label:'VELVET PAD',synthMode:'pad',synthFilter:0.64,space:0.72,tone:0.68,drive:0.08,polySynth:true,synthDetune:0.012,synthMotion:0.28,synthPunch:0.3},
    cathedral_pad:{label:'CATHEDRAL PAD',synthMode:'pad',synthFilter:0.72,space:0.88,tone:0.76,drive:0.04,polySynth:true,synthDetune:0.016,synthMotion:0.34,synthPunch:0.26},
    neon_lead:{label:'NEON LEAD',synthMode:'lead',synthFilter:0.72,space:0.28,tone:0.74,drive:0.22,polySynth:false,synthDetune:0.01,synthMotion:0.48,synthPunch:0.72},
    razor_lead:{label:'RAZOR LEAD',synthMode:'lead',synthFilter:0.82,space:0.18,tone:0.78,drive:0.3,polySynth:false,synthDetune:0.008,synthMotion:0.42,synthPunch:0.84},
    glass_bell:{label:'GLASS BELL',synthMode:'glass',synthFilter:0.78,space:0.54,tone:0.82,drive:0.06,polySynth:true,synthDetune:0.004,synthMotion:0.24,synthPunch:0.44},
    prism_bell:{label:'PRISM BELL',synthMode:'bell',synthFilter:0.86,space:0.58,tone:0.88,drive:0.05,polySynth:true,synthDetune:0.003,synthMotion:0.18,synthPunch:0.48},
    air_organ:{label:'AIR ORGAN',synthMode:'organ',synthFilter:0.52,space:0.34,tone:0.62,drive:0.12,polySynth:true,fmIdx:0.72,synthDetune:0.006,synthMotion:0.2,synthPunch:0.62},
    house_organ:{label:'HOUSE ORGAN',synthMode:'organ',synthFilter:0.58,space:0.3,tone:0.7,drive:0.16,polySynth:true,fmIdx:0.64,synthDetune:0.004,synthMotion:0.16,synthPunch:0.68},
    string_machine:{label:'STRING MACHINE',synthMode:'strings',synthFilter:0.68,space:0.66,tone:0.7,drive:0.08,polySynth:true,synthDetune:0.012,synthMotion:0.32,synthPunch:0.34},
    noir_strings:{label:'NOIR STRINGS',synthMode:'strings',synthFilter:0.6,space:0.72,tone:0.64,drive:0.06,polySynth:true,synthDetune:0.014,synthMotion:0.4,synthPunch:0.3},
    choir_mist:{label:'CHOIR MIST',synthMode:'choir',synthFilter:0.58,space:0.76,tone:0.66,drive:0.04,polySynth:true,synthDetune:0.01,synthMotion:0.22,synthPunch:0.28},
    star_noise:{label:'STAR NOISE',synthMode:'star',synthFilter:0.8,space:0.62,tone:0.86,drive:0.14,polySynth:true,synthDetune:0.008,synthMotion:0.36,synthPunch:0.4},
    cinematic_air:{label:'CINEMATIC AIR',synthMode:'air',synthFilter:0.6,space:0.84,tone:0.74,drive:0.02,polySynth:true,fmIdx:0.54,synthDetune:0.006,synthMotion:0.44,synthPunch:0.22},
    mist_pluck:{label:'MIST PLUCK',synthMode:'mist',synthFilter:0.44,space:0.46,tone:0.58,drive:0.12,polySynth:false,synthDetune:0.006,synthMotion:0.52,synthPunch:0.74},
    bell_shard:{label:'BELL SHARD',synthMode:'bell',synthFilter:0.82,space:0.48,tone:0.8,drive:0.04,polySynth:true,synthDetune:0.005,synthMotion:0.2,synthPunch:0.5},
    wide_arp:{label:'WIDE ARP',synthMode:'mist',synthFilter:0.56,space:0.52,tone:0.66,drive:0.18,polySynth:false,synthDetune:0.018,synthMotion:0.66,synthPunch:0.76},
    drone_veil:{label:'DRONE VEIL',synthMode:'pad',synthFilter:0.42,space:0.92,tone:0.54,drive:0.03,polySynth:true,synthDetune:0.02,synthMotion:0.52,synthPunch:0.16},
  },
  drum:{
    tight_punch:{label:'TIGHT PUNCH',drumDecay:0.32,noiseMix:0.12,compress:0.18,drive:0.1,kickTone:0.74,snareTone:0.62,hatTone:0.82,hatOpenChance:0.08},
    warehouse:{label:'WAREHOUSE',drumDecay:0.48,noiseMix:0.22,compress:0.28,drive:0.18,kickTone:0.54,snareTone:0.56,hatTone:0.74,hatOpenChance:0.11},
    broken_air:{label:'BROKEN AIR',drumDecay:0.58,noiseMix:0.34,compress:0.24,drive:0.12,swing:0.06,kickTone:0.48,snareTone:0.66,hatTone:0.7,hatOpenChance:0.16},
    industrial_haze:{label:'INDUSTRIAL HAZE',drumDecay:0.64,noiseMix:0.42,compress:0.34,drive:0.28,kickTone:0.42,snareTone:0.74,hatTone:0.6,hatOpenChance:0.14},
    dusty_tape:{label:'DUSTY TAPE',drumDecay:0.44,noiseMix:0.28,compress:0.22,drive:0.16,tone:0.58,kickTone:0.52,snareTone:0.48,hatTone:0.62,hatOpenChance:0.09},
    crisp_club:{label:'CRISP CLUB',drumDecay:0.26,noiseMix:0.1,compress:0.26,drive:0.08,tone:0.68,kickTone:0.78,snareTone:0.68,hatTone:0.9,hatOpenChance:0.1},
    deep_warehouse:{label:'DEEP WAREHOUSE',drumDecay:0.52,noiseMix:0.18,compress:0.3,drive:0.16,kickTone:0.46,snareTone:0.52,hatTone:0.72,hatOpenChance:0.1},
    punch_club:{label:'PUNCH CLUB',drumDecay:0.24,noiseMix:0.08,compress:0.32,drive:0.14,kickTone:0.82,snareTone:0.64,hatTone:0.88,hatOpenChance:0.08},
    rave_metal:{label:'RAVE METAL',drumDecay:0.38,noiseMix:0.26,compress:0.34,drive:0.24,kickTone:0.7,snareTone:0.8,hatTone:0.86,hatOpenChance:0.14},
    velvet_breaks:{label:'VELVET BREAKS',drumDecay:0.46,noiseMix:0.24,compress:0.22,drive:0.12,kickTone:0.58,snareTone:0.6,hatTone:0.74,hatOpenChance:0.18},
    smoky_room:{label:'SMOKY ROOM',drumDecay:0.5,noiseMix:0.32,compress:0.2,drive:0.1,kickTone:0.44,snareTone:0.46,hatTone:0.58,hatOpenChance:0.1},
    hard_grid:{label:'HARD GRID',drumDecay:0.28,noiseMix:0.16,compress:0.38,drive:0.26,kickTone:0.86,snareTone:0.72,hatTone:0.84,hatOpenChance:0.07},
  },
  performance:{
    club_night:{label:'CLUB NIGHT',genre:'acid',grooveAmt:0.7,swing:0.03,space:0.26,tone:0.56,drive:0.18,compress:0.28},
    acid_run:{label:'ACID RUN',genre:'acid',grooveAmt:0.76,swing:0.06,space:0.24,tone:0.42,drive:0.38,compress:0.3},
    jungle_grid:{label:'JUNGLE GRID',genre:'dnb',grooveAmt:0.74,swing:0.05,space:0.22,tone:0.52,drive:0.2,compress:0.24},
    cinematic_rise:{label:'CINEMATIC RISE',genre:'cinematic',grooveAmt:0.5,swing:0.02,space:0.82,tone:0.76,drive:0.04,compress:0.18},
    industrial_drive:{label:'INDUSTRIAL DRIVE',genre:'industrial',grooveAmt:0.78,swing:0.0,space:0.18,tone:0.34,drive:0.48,compress:0.36},
    steel_lobby:{label:'STEEL LOBBY',genre:'industrial',grooveAmt:0.72,swing:0.01,space:0.24,tone:0.38,drive:0.42,compress:0.32},
    pulse_theatre:{label:'PULSE THEATRE',genre:'cinematic',grooveAmt:0.56,swing:0.03,space:0.76,tone:0.78,drive:0.06,compress:0.2},
    break_vector:{label:'BREAK VECTOR',genre:'dnb',grooveAmt:0.8,swing:0.06,space:0.2,tone:0.5,drive:0.24,compress:0.28},
  }
};

const getBassPresetCfg=key=>SOUND_PRESETS.bass[key]||SOUND_PRESETS.bass.sub_floor;
const getSynthPresetCfg=key=>SOUND_PRESETS.synth[key]||SOUND_PRESETS.synth.velvet_pad;
const getDrumPresetCfg=key=>SOUND_PRESETS.drum[key]||SOUND_PRESETS.drum.tight_punch;

const PATTERN_AUTHORITY_LEVELS=['lock','assist','evolve'];
const defaultPatternAuthority=()=>({drums:'assist',bass:'assist',synth:'assist'});
const defaultLaneVolume=()=>({kick:0.96,snare:0.92,hat:0.78,bass:0.9,synth:0.88});
const defaultLaneProbability=()=>({kick:1,snare:1,hat:1,bass:1,synth:1});
const SYNTH_CURVES=['balanced','soft','snappy','bloom','glass'];
const laneAuthorityKey=lane=>(lane==='kick'||lane==='snare'||lane==='hat')?'drums':lane;

const getActiveSoundFamilies=(composition,genre)=>composition?.soundFamilies||getGenreSoundFamilies(genre||'acid');
const preserveLockedLanes=(generated,currentPatterns,currentBass,currentSynth,authority)=>{
  const next={...generated,patterns:{...generated.patterns},bassLine:[...generated.bassLine],synthLine:[...generated.synthLine]};
  if((authority?.drums||'assist')==='lock'){
    next.patterns.kick=(currentPatterns?.kick||next.patterns.kick).map(s=>({...s}));
    next.patterns.snare=(currentPatterns?.snare||next.patterns.snare).map(s=>({...s}));
    next.patterns.hat=(currentPatterns?.hat||next.patterns.hat).map(s=>({...s}));
  }
  if((authority?.bass||'assist')==='lock'){
    next.patterns.bass=(currentPatterns?.bass||next.patterns.bass).map(s=>({...s}));
    next.bassLine=[...(currentBass||next.bassLine)];
  }
  if((authority?.synth||'assist')==='lock'){
    next.patterns.synth=(currentPatterns?.synth||next.patterns.synth).map(s=>({...s}));
    next.synthLine=[...(currentSynth||next.synthLine)];
  }
  return next;
};
const mergeProtectedMutation=(mutated,current,authority)=>{
  const next={...mutated};
  if((authority?.drums||'assist')==='lock'){
    next.kick=current.kick.map(s=>({...s}));
    next.snare=current.snare.map(s=>({...s}));
    next.hat=current.hat.map(s=>({...s}));
  }
  if((authority?.bass||'assist')==='lock')next.bass=current.bass.map(s=>({...s}));
  if((authority?.synth||'assist')==='lock')next.synth=current.synth.map(s=>({...s}));
  return next;
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  // ── Audio
  const audioRef=useRef(null);
  const analyserRef=useRef(null);
  const [isReady,setIsReady]=useState(false);

  // ── Transport
  const [isPlaying,setIsPlaying]=useState(false);
  const isPlayingRef=useRef(false);
  const schedulerRef=useRef(null);
  const nextNoteRef=useRef(0);
  const stepRef=useRef(0);
  const [step,setStep]=useState(0);
  const [bpm,setBpm]=useState(128);
  const bpmRef=useRef(128);
  useEffect(()=>{bpmRef.current=bpm;},[bpm]);

  // ── Song state
  const [genre,setGenre]=useState('acid');
  const [currentSectionName,setCurrentSectionName]=useState('groove');
  const currentSectionNameRef=useRef('groove');
  useEffect(()=>{currentSectionNameRef.current=currentSectionName;},[currentSectionName]);
  const [modeName,setModeName]=useState('minor');
  const [songArc,setSongArc]=useState([]);
  const [arcIdx,setArcIdx]=useState(0);
  const [songActive,setSongActive]=useState(false);
  const songActiveRef=useRef(false);
  const arcRef=useRef([]);
  const arcIdxRef=useRef(0);
  const barCountRef=useRef(0);// bars elapsed in current section

  // ── Patterns
  const [patterns,setPatterns]=useState({kick:mkSteps(),snare:mkSteps(),hat:mkSteps(),bass:mkSteps(),synth:mkSteps()});
  const patternsRef=useRef(patterns);
  useEffect(()=>{patternsRef.current=patterns;},[patterns]);
  const [bassLine,setBassLine]=useState(mkNotes('C2'));
  const bassRef=useRef(bassLine);
  useEffect(()=>{bassRef.current=bassLine;},[bassLine]);
  const [synthLine,setSynthLine]=useState(mkNotes('C4'));
  const synthRef=useRef(synthLine);
  useEffect(()=>{synthRef.current=synthLine;},[synthLine]);
  const [laneLen,setLaneLen]=useState({kick:16,snare:16,hat:32,bass:32,synth:32});
  const laneLenRef=useRef(laneLen);
  useEffect(()=>{laneLenRef.current=laneLen;},[laneLen]);

  // ── Parameters
  const [master,setMaster]=useState(0.85);
  const [swing,setSwing]=useState(0.03);
  const swingRef=useRef(0.03);
  useEffect(()=>{swingRef.current=swing;},[swing]);
  const [humanize,setHumanize]=useState(0.012);
  const humanizeRef=useRef(0.012);
  useEffect(()=>{humanizeRef.current=humanize;},[humanize]);
  const [grooveAmt,setGrooveAmt]=useState(0.65);
  const grooveRef=useRef(0.65);
  useEffect(()=>{grooveRef.current=grooveAmt;},[grooveAmt]);
  const [grooveProfile,setGrooveProfile]=useState('steady');
  const grooveProfileRef=useRef('steady');
  useEffect(()=>{grooveProfileRef.current=grooveProfile;},[grooveProfile]);
  const [space,setSpace]=useState(0.3);
  const [tone,setTone]=useState(0.7);
  const [noiseMix,setNoiseMix]=useState(0.2);
  const [drive,setDrive]=useState(0.1);
  const [compress,setCompress]=useState(0.3);
  const [bassFilter,setBassFilter]=useState(0.55);
  const [synthFilter,setSynthFilter]=useState(0.65);
  const [drumDecay,setDrumDecay]=useState(0.5);
  const [bassSubAmt,setBassSubAmt]=useState(0.5);
  const [fmIdx,setFmIdx]=useState(0.6);
  const fmIdxRef=useRef(0.6);
  useEffect(()=>{fmIdxRef.current=fmIdx;},[fmIdx]);
  const [polySynth,setPolySynth]=useState(true);
  const [bassStack,setBassStack]=useState(true);
  const [bassPreset,setBassPreset]=useState('sub_floor');
  const [synthPreset,setSynthPreset]=useState('velvet_pad');
  const [drumPreset,setDrumPreset]=useState('tight_punch');
  const [performancePreset,setPerformancePreset]=useState('club_night');
  const bassPresetCfg=getBassPresetCfg(bassPreset);
  const synthPresetCfg=getSynthPresetCfg(synthPreset);
  const drumPresetCfg=getDrumPresetCfg(drumPreset);
  const [soundCharacter,setSoundCharacter]=useState(getGenreSoundCharacter('acid'));
  const soundCharacterRef=useRef(getGenreSoundCharacter('acid'));
  useEffect(()=>{soundCharacterRef.current=soundCharacter;},[soundCharacter]);
  const [compositionEnergy,setCompositionEnergy]=useState(0.68);
  const compositionEnergyRef=useRef(0.68);
  useEffect(()=>{compositionEnergyRef.current=compositionEnergy;},[compositionEnergy]);
  const [patternAuthority,setPatternAuthority]=useState(defaultPatternAuthority());
  const patternAuthorityRef=useRef(defaultPatternAuthority());
  useEffect(()=>{patternAuthorityRef.current=patternAuthority;},[patternAuthority]);
  const [laneVolume,setLaneVolume]=useState(defaultLaneVolume());
  const laneVolumeRef=useRef(defaultLaneVolume());
  useEffect(()=>{laneVolumeRef.current=laneVolume;},[laneVolume]);
  const [laneProbability,setLaneProbability]=useState(defaultLaneProbability());
  const laneProbabilityRef=useRef(defaultLaneProbability());
  useEffect(()=>{laneProbabilityRef.current=laneProbability;},[laneProbability]);
  const [synthChordChance,setSynthChordChance]=useState(0.34);
  const synthChordChanceRef=useRef(0.34);
  useEffect(()=>{synthChordChanceRef.current=synthChordChance; if(typeof globalThis!=='undefined')globalThis.__CESIRA_SYNTH_CHORD_CHANCE__=synthChordChance;},[synthChordChance]);
  const [synthHold,setSynthHold]=useState(0.56);
  const synthHoldRef=useRef(0.56);
  useEffect(()=>{synthHoldRef.current=synthHold; if(typeof globalThis!=='undefined')globalThis.__CESIRA_SYNTH_HOLD__=synthHold;},[synthHold]);
  const [synthCurve,setSynthCurve]=useState('balanced');
  const synthCurveRef=useRef('balanced');
  useEffect(()=>{synthCurveRef.current=synthCurve; if(typeof globalThis!=='undefined')globalThis.__CESIRA_SYNTH_CURVE__=synthCurve;},[synthCurve]);

  // ── Autopilot
  const [autopilot,setAutopilot]=useState(false);
  const autopilotRef=useRef(false);
  useEffect(()=>{autopilotRef.current=autopilot;},[autopilot]);
  const autopilotTimerRef=useRef(null);
  const [autopilotIntensity,setAutopilotIntensity]=useState(0.5);

  // ── Composition seed for transformations
  const seedRef=useRef(null);
  const lastBassRef=useRef('C2');
  const progressionRef=useRef(CHORD_PROGS.minor[0]);
  const arpModeRef=useRef('up');
  const compositionRef=useRef(createCompositionBlueprint('acid','minor',CHORD_PROGS.minor[0],'up'));
  const compositionCycleRef=useRef(0);
  const [arpMode,setArpMode]=useState('up');

  // ── UI state
  const [view,setView]=useState('perform');// 'perform' | 'studio' | 'song'
  const [activeTab,setActiveTab]=useState('mix');
  const [activeLane,setActiveLane]=useState('kick');
  const [laneVU,setLaneVU]=useState({kick:0,snare:0,hat:0,bass:0,synth:0});
  const vuTimers=useRef({});
  const [page,setPage]=useState(0);
  const [status,setStatus]=useState('Ready — press PLAY');
  const [recordings,setRecordings]=useState([]);
  const [recState,setRecState]=useState('idle');
  const recorderRef=useRef(null);
  const chunksRef=useRef([]);
  const [projectName,setProjectName]=useState('CESIRA SESSION');
  const [savedScenes,setSavedScenes]=useState([null,null,null,null,null,null]);
  const [midiOk,setMidiOk]=useState(false);
  const midiRef=useRef(null);
  const [tapTimes,setTapTimes]=useState([]);
  const undoStack=useRef([]);
  const [undoLen,setUndoLen]=useState(0);
  const [vizData,setVizData]=useState(new Uint8Array(64));
  const transportBarRef=useRef(0);

  // ── Active notes display
  const [activeNotes,setActiveNotes]=useState({bass:'—',synth:'—'});
  const setAuthorityForLane=useCallback((lane,value)=>{
    const key=laneAuthorityKey(lane);
    if(!PATTERN_AUTHORITY_LEVELS.includes(value))return;
    setPatternAuthority(prev=>{const next={...prev,[key]:value};patternAuthorityRef.current=next;return next;});
  },[]);

  // ─── AUDIO ENGINE ─────────────────────────────────────────────────────────
  const driveCurve=(node,amt)=>{
    const k=2+clamp(amt,0,1)*60;const s=512;const c=new Float32Array(s);
    for(let i=0;i<s;i++){const x=(i*2)/s-1;c[i]=((1+k)*x)/(1+k*Math.abs(x));}
    node.curve=c;node.oversample='2x';
  };
  const identityCurve=node=>{const c=new Float32Array(512);for(let i=0;i<512;i++){c[i]=(i*2)/512-1;}node.curve=c;};
  const reverbIR=(ctx,dur=1.2,dec=2.6)=>{const sr=ctx.sampleRate,l=Math.floor(sr*dur);const b=ctx.createBuffer(2,l,sr);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<l;i++)d[i]=(rnd()*2-1)*Math.pow(1-i/l,dec);}return b;};

  const initAudio=async()=>{
    if(audioRef.current){await audioRef.current.ctx.resume();setIsReady(true);return;}
    const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
    const ctx=new Ctx({sampleRate:44100,latencyHint:'interactive'});
    const bus=ctx.createGain();bus.gain.value=0.68;
    const preD=ctx.createWaveShaper();identityCurve(preD);
    const toneF=ctx.createBiquadFilter();toneF.type='lowpass';toneF.frequency.value=16000;toneF.Q.value=0.35;
    const comp=ctx.createDynamicsCompressor();comp.threshold.value=-24;comp.knee.value=18;comp.ratio.value=3;comp.attack.value=0.008;comp.release.value=0.22;
    const lim=ctx.createDynamicsCompressor();lim.threshold.value=-3;lim.knee.value=0;lim.ratio.value=20;lim.attack.value=0.001;lim.release.value=0.04;
    const dry=ctx.createGain(),wet=ctx.createGain();dry.gain.value=1;wet.gain.value=0;
    const spl=ctx.createChannelSplitter(2),mrg=ctx.createChannelMerger(2);
    const lDly=ctx.createDelay(0.5),rDly=ctx.createDelay(0.5),fb=ctx.createGain(),dlyT=ctx.createBiquadFilter();
    dlyT.type='lowpass';dlyT.frequency.value=4500;fb.gain.value=0.15;
    const chorus=ctx.createGain();chorus.gain.value=0;
    const cD1=ctx.createDelay(0.025),cD2=ctx.createDelay(0.031);
    const rev=ctx.createConvolver();rev.buffer=reverbIR(ctx);
    const revW=ctx.createGain();revW.gain.value=0;
    const out=ctx.createGain();out.gain.value=0.88;
    const an=ctx.createAnalyser();an.fftSize=256;an.smoothingTimeConstant=0.8;
    const dest=ctx.createMediaStreamDestination();
    bus.connect(preD);preD.connect(toneF);toneF.connect(comp);
    comp.connect(dry);comp.connect(spl);comp.connect(cD1);comp.connect(cD2);comp.connect(rev);
    cD1.connect(chorus);cD2.connect(chorus);rev.connect(revW);
    spl.connect(lDly,0);spl.connect(rDly,1);rDly.connect(dlyT);dlyT.connect(fb);fb.connect(lDly);
    lDly.connect(mrg,0,0);rDly.connect(mrg,0,1);mrg.connect(wet);
    dry.connect(out);wet.connect(out);chorus.connect(out);revW.connect(out);
    out.connect(lim);lim.connect(an);lim.connect(ctx.destination);lim.connect(dest);
    audioRef.current={ctx,bus,preD,toneF,comp,lim,dry,wet,lDly,rDly,fb,chorus,revW,out,an,dest};
    analyserRef.current=an;
    setIsReady(true);setStatus('Audio online');
    applyFxNow();
  };

  const applyFxNow=()=>{
    const a=audioRef.current;if(!a)return;
    const now=a.ctx.currentTime;
    const gd=GENRES[genre];const fx=gd.fxProfile;
    driveCurve(a.preD,clamp(fx.drive*0.4+drive*0.1,0,0.38));
    a.toneF.frequency.linearRampToValueAtTime(clamp(1800+12000*fx.tone*tone,600,19000),now+0.08);
    a.lDly.delayTime.linearRampToValueAtTime(clamp(0.02+space*0.08,0.01,0.45),now+0.08);
    a.rDly.delayTime.linearRampToValueAtTime(clamp(0.03+space*0.1,0.01,0.45),now+0.08);
    a.fb.gain.linearRampToValueAtTime(clamp(0.06+space*0.2,0.03,0.4),now+0.08);
    a.wet.gain.linearRampToValueAtTime(clamp(space*0.18,0,0.25),now+0.08);
    a.dry.gain.linearRampToValueAtTime(clamp(0.95-space*0.08,0.72,0.97),now+0.08);
    a.chorus.gain.linearRampToValueAtTime(clamp(space*0.08,0,0.14),now+0.12);
    a.revW.gain.linearRampToValueAtTime(clamp(fx.space*space*0.22,0,0.28),now+0.14);
    a.comp.attack.value=clamp(0.006+compress*0.012,0.004,0.03);
    a.comp.release.value=clamp(0.16+space*0.2+compress*0.12,0.12,0.42);
    a.out.gain.linearRampToValueAtTime(master,now+0.06);
    a.comp.threshold.value=clamp(-20-compress*12,-32,-6);
    a.comp.ratio.value=clamp(2+compress*5,1.5,8);
  };
  useEffect(()=>{if(audioRef.current)applyFxNow();},[space,tone,drive,compress,master,genre]);

  // Per-lane gain nodes
  const laneGains=useRef({});
  const laneBuses=useRef({});
  const getLaneGain=(lane)=>{
    const a=audioRef.current;if(!a)return null;
    if(!laneGains.current[lane]){
      const g=a.ctx.createGain();
      g.gain.value=laneVolumeRef.current[lane]??1;
      const familyKind=lane==='kick'||lane==='snare'||lane==='hat'?'drums':lane;
      const families=getActiveSoundFamilies(compositionRef.current,genre);
      const mix=getGenreMixProfile(genre);
      const famName=families[familyKind]||getGenreSoundFamilies(genre)[familyKind];
      const famCfg=getSoundFamilyConfig(familyKind,famName);
      const sh=a.ctx.createWaveShaper();
      driveCurve(sh,clamp(0.06+(famCfg.drive||0)*0.22+(mix.drumDrive||0)*0.12,0,0.56));
      const toneF=a.ctx.createBiquadFilter(); toneF.type=familyKind==='bass'?'lowpass':'highpass';
      toneF.frequency.value=familyKind==='drums'?clamp(6800+(famCfg.air||0)*7200+(mix.drumAir||0)*2200,3800,18000):familyKind==='bass'?clamp(420+(famCfg.filter||0)*900+(mix.bassBody||0)*700,180,2600):clamp(240+(famCfg.filter||0)*2600+(mix.synthAir||0)*1600,180,10000);
      const comp=a.ctx.createDynamicsCompressor(); comp.threshold.value=-24-(famCfg.comp||0)*10; comp.ratio.value=1.8+(famCfg.comp||0)*5; comp.attack.value=0.006; comp.release.value=0.16+(famCfg.space||0)*0.14;
      const send=a.ctx.createGain(); send.gain.value=clamp((familyKind==='synth'?0.08:familyKind==='drums'?0.03:0.02)+Math.max(0,famCfg.space||0)*0.08,0,0.18);
      g.connect(sh); sh.connect(toneF); toneF.connect(comp); comp.connect(a.bus); comp.connect(send); send.connect(a.revW);
      laneGains.current[lane]=g; laneBuses.current[lane]={sh,toneF,comp,send,familyKind};
    }
    return laneGains.current[lane];
  };
  useEffect(()=>{
    const a=audioRef.current;if(!a)return;
    Object.entries(laneVolume).forEach(([lane,val])=>{
      const g=getLaneGain(lane);if(!g)return;
      try{g.gain.cancelScheduledValues(a.ctx.currentTime);g.gain.setTargetAtTime(clamp(val,0,1.2),a.ctx.currentTime,0.02);}catch{g.gain.value=clamp(val,0,1.2);}
    });
  },[laneVolume,isReady]);

  useEffect(()=>{
    const a=audioRef.current;if(!a)return;
    Object.entries(laneBuses.current).forEach(([lane,bus])=>{
      const familyKind=bus.familyKind;
      const families=getActiveSoundFamilies(compositionRef.current,genre);
      const famCfg=getSoundFamilyConfig(familyKind,families[familyKind]||getGenreSoundFamilies(genre)[familyKind]);
      const mix=getGenreMixProfile(genre);
      driveCurve(bus.sh,clamp(0.05+(famCfg.drive||0)*0.24+(drive*0.04)+(familyKind==='drums'?(mix.drumDrive||0)*0.16:0),0,0.58));
      if(familyKind==='drums')bus.toneF.frequency.setTargetAtTime(clamp(6400+(famCfg.air||0)*6200+(tone*1100)+(mix.drumAir||0)*2200,3400,18000),a.ctx.currentTime,0.04);
      else if(familyKind==='bass')bus.toneF.frequency.setTargetAtTime(clamp(420+(famCfg.filter||0)*900+bassFilter*1400+(mix.bassBody||0)*600,180,2600),a.ctx.currentTime,0.04);
      else bus.toneF.frequency.setTargetAtTime(clamp(420+(famCfg.filter||0)*2600+synthFilter*4200+(mix.synthAir||0)*1600,220,14000),a.ctx.currentTime,0.04);
      bus.comp.threshold.value=clamp(-24-(famCfg.comp||0)*10-compress*4,-36,-8);
      bus.comp.ratio.value=clamp(1.6+(famCfg.comp||0)*4+compress*2,1.2,8);
      bus.send.gain.setTargetAtTime(clamp((familyKind==='synth'?0.08:familyKind==='drums'?0.03:0.02)+space*0.08+Math.max(0,famCfg.space||0)*0.08,0,0.22),a.ctx.currentTime,0.05);
    });
  },[genre,space,tone,drive,compress,bassFilter,synthFilter,isReady]);

  const ss=(n,t)=>{try{n.start(t);}catch{}};
  const st=(n,t)=>{try{n.stop(t);}catch{}};
  const gc=(src,nodes,ms)=>{const fn=()=>[src,...nodes].forEach(n=>{try{n.disconnect();}catch{}});src.onended=fn;setTimeout(fn,ms);};
  const activeNodes=useRef(0);
  const nodeGuard=()=>activeNodes.current<90;
  const trackNode=ms=>{activeNodes.current++;setTimeout(()=>{activeNodes.current=Math.max(0,activeNodes.current-1);},ms+80);};

  const flashLane=useCallback((lane,level=1)=>{
    setLaneVU(p=>({...p,[lane]:Math.min(1,level)}));
    if(vuTimers.current[lane])clearInterval(vuTimers.current[lane]);
    vuTimers.current[lane]=setInterval(()=>setLaneVU(p=>{const nv=Math.max(0,p[lane]-0.2);if(nv<=0)clearInterval(vuTimers.current[lane]);return{...p,[lane]:nv};}),55);
  },[]);

  const noiseBuffer=(len=0.22,amt=1,color='white')=>{
    const a=audioRef.current;const sr=a.ctx.sampleRate;
    const b=a.ctx.createBuffer(1,Math.floor(sr*len),sr);const d=b.getChannelData(0);
    if(color==='white'){for(let i=0;i<d.length;i++)d[i]=(rnd()*2-1)*amt;return b;}
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0;
    for(let i=0;i<d.length;i++){
      const w=rnd()*2-1;
      if(color==='pink'){b0=0.99886*b0+w*0.0555179;b1=0.99332*b1+w*0.0750759;b2=0.969*b2+w*0.153852;b3=0.8665*b3+w*0.310486;b4=0.55*b4+w*0.532952;b5=-0.7616*b5-w*0.016898;d[i]=(b0+b1+b2+b3+b4+b5+w*0.5362)*amt*0.11;}
      else{b0=0.99*b0+w*0.01;d[i]=b0*amt*3;}
    }
    return b;
  };

  const stepSec=()=>(60/bpmRef.current)/4;
  const laneHash=(lane,step,bar=0,extra=0)=>{
    const base=(lane.charCodeAt(0)*131+lane.length*17+step*37+bar*53+extra*97)%997;
    return (Math.sin(base*12.9898)*43758.5453)%1;
  };
  const humanizeEvent=(lane,step,bar,accent=1)=>{
    const laneScale=lane==='hat'?1.35:lane==='snare'?1.1:lane==='kick'?0.72:lane==='bass'?0.95:0.9;
    const jitter=((laneHash(lane,step,bar,1)+laneHash(lane,step,bar,2))*0.5-0.5)*humanizeRef.current*0.03*laneScale;
    const velShape=1+((laneHash(lane,step,bar,3)-0.5)*0.22*laneScale);
    const toneShift=(laneHash(lane,step,bar,4)-0.5)*0.22;
    const decayShift=(laneHash(lane,step,bar,5)-0.5)*0.18;
    return {
      jitter,
      accent:clamp(accent*velShape,0.08,1.18),
      toneShift,
      decayShift,
      variant:laneHash(lane,step,bar,6)>0.5?1:0,
    };
  };
  const drumRuntimeVariation=(lane,step,bar)=>{
    const pos=step%16;
    const every2=bar%2===1;
    const every4=bar%4===3;
    const every8=bar%8===7;
    const out={extra:false,ghost:false,accentMul:1,openBias:0,variantBias:0};
    if(lane==='hat'){
      if(every2&&(pos===7||pos===15))out.accentMul=1.08;
      if(every4&&(pos===11||pos===13))out.extra=true;
      if(every8&&pos>=12)out.openBias=0.08+(pos-12)*0.025;
      if((bar+pos)%3===0)out.variantBias=0.18;
    } else if(lane==='snare'){
      if(every2&&(pos===4||pos===12))out.ghost=true;
      if(every4&&pos===15)out.extra=true;
      if(every8&&(pos===14||pos===15))out.accentMul=1.12;
      if(pos===12)out.variantBias=0.22;
    } else if(lane==='kick'){
      if(every2&&(pos===0||pos===8))out.accentMul=1.05;
      if(every4&&pos===14)out.extra=true;
      if(every8&&pos>=12)out.accentMul=1.08;
      if(pos===0||pos===14)out.variantBias=0.16;
    }
    return out;
  };
  const duckMixFromKick=(accent,t)=>{
    const bassGain=laneGains.current.bass;
    const synthGain=laneGains.current.synth;
    const duckAmt=clamp(0.84-(accent*0.12+compress*0.05),0.66,0.9);
    [['bass',bassGain],['synth',synthGain]].forEach(([lane,g],idx)=>{
      if(!g)return;
      const release=idx===0?0.12:0.18;
      const base=clamp(laneVolumeRef.current[lane]??1,0.001,1.2);
      try{
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(0.001,g.gain.value||base),t);
        g.gain.linearRampToValueAtTime(Math.max(0.001,base*duckAmt),t+0.008);
        g.gain.exponentialRampToValueAtTime(Math.max(0.001,base),t+release);
      }catch{}
    });
  };

  // ─── DRUM SYNTHESIS ────────────────────────────────────────────────────────
  const playKick=(accent,t,variation={})=>{
    if(!nodeGuard())return;
    const a=audioRef.current;const gd=GENRES[genre];
    const charCfg=getCharacterConfig(soundCharacterRef.current);
    const energy=compositionEnergyRef.current;
    const sectionName=currentSectionNameRef.current||'groove';
    const drumFamilyCfg=getSoundFamilyConfig('drums', getActiveSoundFamilies(compositionRef.current,genre).drums);
    const voice=chooseDrumVoice('kick',sectionName,genre,accent,energy,variation);
    const ctxMod=getDrumContextModifiers('kick',sectionName,energy,accent,variation,voice,genre);
    const genreMix=getGenreMixProfile(genre);
    const kickTone=clamp((drumPresetCfg.kickTone??0.6)+charCfg.toneBias*0.42+(variation.toneShift||0)*0.55+(variation.variantBias||0)*0.4+energy*0.04+(drumFamilyCfg.tone||0)*0.45+(voice.brightness||0)*0.18+(genreMix.drumOpen||0)*0.6,0.18,1.22);
    const kf=gd.kickFreq||90,ke=gd.kickEnd||35;
    const startFreq=clamp(kf*(0.9+kickTone*0.34)*(voice.pitch||1)*(1+((variation.variantBias||0)-0.08)*0.03),42,160);
    const endFreq=clamp(ke*(0.84+kickTone*0.4)*(voice.pitch?Math.max(0.82,voice.pitch*0.92):1),18,86);
    const et=(0.055+drumDecay*0.14+(1-kickTone)*0.022+Math.max(-0.015,(variation.decayShift||0)*0.028))*ctxMod.decayMul;
    const dt=(0.12+drumDecay*0.24+(1-kickTone)*0.032+Math.max(-0.03,(variation.decayShift||0)*0.05))*ctxMod.decayMul;
    const body=a.ctx.createOscillator(),bG=a.ctx.createGain();
    const punch=a.ctx.createOscillator(),pG=a.ctx.createGain();
    const sub=a.ctx.createOscillator(),sG=a.ctx.createGain();
    const click=a.ctx.createBufferSource(),cG=a.ctx.createGain();
    const tail=a.ctx.createOscillator(),tG=a.ctx.createGain();
    const air=a.ctx.createBufferSource(),airF=a.ctx.createBiquadFilter(),airG=a.ctx.createGain();
    const mG=a.ctx.createGain(),sh=a.ctx.createWaveShaper(),bodyF=a.ctx.createBiquadFilter();
    body.type=(voice.name==='hard_clipped'||voice.name==='tight_dry')?'triangle':(variation.variant?(kickTone>0.7?'triangle':'sine'):(kickTone>0.82?'triangle':'sine'));
    body.frequency.setValueAtTime(startFreq,t);body.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),t+et);
    punch.type=(voice.name==='dirty_industrial'||voice.name==='hard_clipped')?'square':(kickTone>0.68?'triangle':'sine');
    punch.frequency.setValueAtTime(startFreq*(1.7+(voice.click||0)*0.18),t);punch.frequency.exponentialRampToValueAtTime(Math.max(30,endFreq*1.35),t+Math.max(0.016,et*0.42));
    sub.type='sine';sub.frequency.setValueAtTime(startFreq*0.5,t);sub.frequency.exponentialRampToValueAtTime(Math.max(18,endFreq*0.5),t+et*1.08);
    tail.type=voice.name==='cinematic_boom'||voice.name==='long_boom'?'sine':'triangle';tail.frequency.setValueAtTime(startFreq*(0.94+(voice.tail||0)*0.06),t);tail.frequency.exponentialRampToValueAtTime(Math.max(22,endFreq*(0.66+(voice.tail||0)*0.2)),t+dt*0.9);
    const cb=a.ctx.createBuffer(1,Math.floor(a.ctx.sampleRate*0.0048),a.ctx.sampleRate);
    const cd=cb.getChannelData(0);for(let i=0;i<cd.length;i++)cd[i]=(rnd()*2-1)*(1-i/cd.length);
    click.buffer=cb;
    const ab=a.ctx.createBuffer(1,Math.floor(a.ctx.sampleRate*0.012),a.ctx.sampleRate);
    const ad=ab.getChannelData(0);for(let i=0;i<ad.length;i++)ad[i]=(rnd()*2-1)*(1-i/ad.length)*(0.35+rnd()*0.65);
    air.buffer=ab;
    bodyF.type='lowpass';bodyF.frequency.value=clamp(((sectionName==='drop'?2200:sectionName==='build'?1500:sectionName==='break'?900:1200)*ctxMod.toneOpen)+(kickTone*2200)+(tone+charCfg.toneBias)*460+energy*180+(drumFamilyCfg.air||0)*600+(voice.brightness||0)*1400,420,7200);
    driveCurve(sh,clamp((0.08+(noiseMix+charCfg.noiseBias)*0.06+(drive+charCfg.driveBias)*0.05+kickTone*0.06+energy*0.02+(drumFamilyCfg.drive||0)*0.12+(voice.drive||0)*0.18)*ctxMod.driveMul,0,0.6));
    airF.type='bandpass';airF.frequency.value=clamp(1800+(voice.brightness||0)*2600+energy*800,1200,7200);airF.Q.value=0.9+(voice.click||0)*0.6;
    bG.gain.setValueAtTime(0,t);bG.gain.linearRampToValueAtTime((0.58+(voice.body||1)*0.16+kickTone*0.14)*accent,t+0.0012);bG.gain.exponentialRampToValueAtTime(0.001,t+dt);
    pG.gain.setValueAtTime(0,t);pG.gain.linearRampToValueAtTime((0.05+(voice.click||0)*0.18+kickTone*0.1)*accent*ctxMod.transientMul,t+0.0008);pG.gain.exponentialRampToValueAtTime(0.001,t+Math.max(0.02,dt*0.24));
    sG.gain.setValueAtTime(0,t);sG.gain.linearRampToValueAtTime((0.18+(voice.sub||1)*0.18+bassSubAmt*0.26)*(1-kickTone*0.12)*accent,t+0.001);sG.gain.exponentialRampToValueAtTime(0.001,t+dt*1.2);
    cG.gain.setValueAtTime(0,t);cG.gain.linearRampToValueAtTime((0.06+(voice.click||0)*0.22+noiseMix*0.06+(drumFamilyCfg.transient||0)*0.16)*accent*ctxMod.transientMul,t+0.0005);cG.gain.exponentialRampToValueAtTime(0.001,t+0.0038+Math.max(0,voice.brightness||0)*0.003+kickTone*0.0024);
    tG.gain.setValueAtTime(0,t);tG.gain.linearRampToValueAtTime((0.04+(voice.tail||0)*0.18+(drumFamilyCfg.transient||0)*0.08)*accent,t+0.0012);tG.gain.exponentialRampToValueAtTime(0.001,t+dt*(0.68+(voice.tail||0)*0.22));
    airG.gain.setValueAtTime(0,t);airG.gain.linearRampToValueAtTime((0.012+Math.max(0,voice.brightness||0)*0.04+Math.max(0,drumFamilyCfg.air||0)*0.02)*accent*ctxMod.airMul,t+0.0008);airG.gain.exponentialRampToValueAtTime(0.001,t+0.012+(voice.click||0)*0.004);
    body.connect(bodyF);bodyF.connect(sh);sh.connect(bG);punch.connect(pG);sub.connect(sG);click.connect(cG);tail.connect(tG);air.connect(airF);airF.connect(airG);
    bG.connect(mG);pG.connect(mG);sG.connect(mG);cG.connect(mG);tG.connect(mG);airG.connect(mG);
    const dest=getLaneGain('kick')||a.bus;mG.connect(dest);
    duckMixFromKick(accent,t);
    const dur=(dt+0.14)*1000+240;trackNode(dur);
    gc(body,[bodyF,punch,sub,click,tail,air,airF,bG,pG,sG,cG,tG,airG,mG,sh],dur);
    ss(body,t);ss(punch,t);ss(sub,t);ss(click,t);ss(tail,t);ss(air,t);st(body,t+dt+0.06);st(punch,t+dt*0.34+0.03);st(sub,t+dt+0.1);st(click,t+0.01);st(tail,t+dt*(0.76+(voice.tail||0)*0.18));st(air,t+0.03);
  };

  const playSnare=(accent,t,variation={})=>{
    if(!nodeGuard())return;
    const a=audioRef.current;const gd=GENRES[genre];
    const charCfg=getCharacterConfig(soundCharacterRef.current);
    const energy=compositionEnergyRef.current;
    const sectionName=currentSectionNameRef.current||'groove';
    const drumFamilyCfg=getSoundFamilyConfig('drums', getActiveSoundFamilies(compositionRef.current,genre).drums);
    const voice=chooseDrumVoice('snare',sectionName,genre,accent,energy,variation);
    const ctxMod=getDrumContextModifiers('snare',sectionName,energy,accent,variation,voice,genre);
    const genreMix=getGenreMixProfile(genre);
    const snareTone=clamp((drumPresetCfg.snareTone??0.6)+charCfg.toneBias*0.42+(variation.toneShift||0)*0.45+(variation.variantBias||0)*0.42+energy*0.03+(drumFamilyCfg.tone||0)*0.34+(voice.brightness||0)*0.18+(genreMix.drumOpen||0)*0.4,0.18,1.16);
    const noiseDur=(0.14+drumDecay*0.1+Math.max(-0.03,(variation.decayShift||0)*0.04))*ctxMod.decayMul;
    const nb=noiseBuffer(noiseDur,0.16+noiseMix*0.34+(voice.noise||0)*0.12+(variation.ghost?0.03:0),gd.noiseColor||'white');
    const src=a.ctx.createBufferSource(),fil=a.ctx.createBiquadFilter(),bp=a.ctx.createBiquadFilter(),snap=a.ctx.createBiquadFilter(),g=a.ctx.createGain();
    const osc=a.ctx.createOscillator(),og=a.ctx.createGain();
    const bodyOsc=a.ctx.createOscillator(),bodyG=a.ctx.createGain();
    const snapNoise=a.ctx.createBufferSource(),snapG=a.ctx.createGain();
    const clapNoise=a.ctx.createBufferSource(),clapF=a.ctx.createBiquadFilter(),clapG=a.ctx.createGain();
    const snapBuf=noiseBuffer(0.018+noiseMix*0.01,0.46,'white');
    const clapBuf=noiseBuffer(0.038+noiseMix*0.012,0.38,'white');
    src.buffer=nb; snapNoise.buffer=snapBuf; clapNoise.buffer=clapBuf;
    fil.type='bandpass';fil.frequency.value=clamp(1100+snareTone*2300+(voice.brightness||0)*900+noiseMix*280+(genreMix.drumOpen||0)*900,520,5200);fil.Q.value=0.7+compress*0.42+(voice.metal||0)*0.4;
    bp.type='highpass';bp.frequency.value=clamp(140+snareTone*260+(voice.body||0)*40,90,620);
    snap.type='bandpass';snap.frequency.value=clamp(2400+snareTone*1900+(voice.brightness||0)*1200+(variation.variant?260:0),1700,6400);snap.Q.value=1.1+(voice.snap||0)*0.4+(variation.ghost?0.15:0.4);
    clapF.type='bandpass';clapF.frequency.value=clamp(1500+snareTone*900+(voice.brightness||0)*600,900,4200);clapF.Q.value=0.85;
    osc.type=snareTone>0.6?'triangle':'sine';osc.frequency.value=clamp(140+snareTone*110+(voice.body||0)*22,120,320);
    bodyOsc.type=voice.name==='metallic_crack'?'square':'triangle';bodyOsc.frequency.value=clamp(170+snareTone*100+(voice.body||0)*26,130,360);
    og.gain.setValueAtTime(0,t);og.gain.linearRampToValueAtTime((0.04+(voice.snap||0)*0.16+snareTone*0.1)*(variation.ghost?0.55:1)*accent,t+0.001);og.gain.exponentialRampToValueAtTime(0.001,t+0.04*ctxMod.decayMul+drumDecay*0.08);
    snapG.gain.setValueAtTime(0,t);snapG.gain.linearRampToValueAtTime((0.05+(voice.snap||0)*0.18+energy*0.03+(drumFamilyCfg.transient||0)*0.1)*(variation.ghost?0.4:1)*accent*ctxMod.transientMul,t+0.0007);snapG.gain.exponentialRampToValueAtTime(0.001,t+0.018+drumDecay*0.02+(voice.snap||0)*0.01);
    bodyG.gain.setValueAtTime(0,t);bodyG.gain.linearRampToValueAtTime((0.03+(voice.body||0)*0.12+snareTone*0.04)*(variation.ghost?0.46:1)*accent,t+0.0012);bodyG.gain.exponentialRampToValueAtTime(0.001,t+0.07+drumDecay*0.1+(voice.decay||1)*0.012);
    clapG.gain.setValueAtTime(0,t);clapG.gain.linearRampToValueAtTime((voice.name==='clap_hybrid'||voice.name==='wide_rave'?0.06:0.025)*(variation.ghost?0.24:1)*accent,t+0.001);clapG.gain.exponentialRampToValueAtTime(0.001,t+0.045+(voice.decay||1)*0.02);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime((0.28+snareTone*0.18+(voice.body||0)*0.08)*(variation.ghost?0.52:1)*accent,t+0.002);g.gain.exponentialRampToValueAtTime(0.001,t+0.048+drumDecay*0.14+(voice.decay||1)*0.02);
    src.connect(fil);fil.connect(bp);bp.connect(g);osc.connect(og);og.connect(g);bodyOsc.connect(bodyG);bodyG.connect(g);snapNoise.connect(snap);snap.connect(snapG);snapG.connect(g);clapNoise.connect(clapF);clapF.connect(clapG);clapG.connect(g);
    const destBase=getLaneGain('snare')||a.bus;
    const panNode=a.ctx.createStereoPanner?a.ctx.createStereoPanner():null;
    if(panNode){panNode.pan.value=clamp((voice.name==='wide_rave'?0.1:0)+(variation.variant?0.04:-0.04),-0.24,0.24);g.connect(panNode);panNode.connect(destBase);}else{g.connect(destBase);}
    gc(src,[fil,bp,snap,g,osc,og,bodyOsc,bodyG,snapNoise,snapG,clapNoise,clapF,clapG],760);
    ss(src,t);ss(osc,t);ss(bodyOsc,t);ss(snapNoise,t);ss(clapNoise,t);st(src,t+0.22);st(osc,t+0.08+drumDecay*0.06);st(bodyOsc,t+0.1+drumDecay*0.08);st(snapNoise,t+0.03);st(clapNoise,t+0.06);
  };

  const playHat=(accent,t,open=false,variation={})=>{
    if(!nodeGuard())return;
    const a=audioRef.current;const gd=GENRES[genre];
    const charCfg=getCharacterConfig(soundCharacterRef.current);
    const energy=compositionEnergyRef.current;
    const sectionName=currentSectionNameRef.current||'groove';
    const drumFamilyCfg=getSoundFamilyConfig('drums', getActiveSoundFamilies(compositionRef.current,genre).drums);
    const voice=chooseDrumVoice('hat',sectionName,genre,accent,energy,variation);
    const ctxMod=getDrumContextModifiers('hat',sectionName,energy,accent,variation,voice,genre);
    const genreMix=getGenreMixProfile(genre);
    const hatTone=clamp((drumPresetCfg.hatTone??0.8)+charCfg.toneBias*0.48+(variation.toneShift||0)*0.5+(variation.variantBias||0)*0.42+energy*0.02+(voice.brightness||0)*0.16+(genreMix.drumAir||0)*0.5,0.18,1.18);
    const noiseAmt=(0.12+noiseMix*0.3+(voice.noise||0)*0.08+(variation.variant?0.01:0));
    const nb=noiseBuffer(open?(0.22+drumDecay*0.08)*ctxMod.openMul:(0.072+drumDecay*0.03)*ctxMod.decayMul,noiseAmt,gd.noiseColor||'white');
    const src=a.ctx.createBufferSource(),hp=a.ctx.createBiquadFilter(),bp=a.ctx.createBiquadFilter(),air=a.ctx.createBiquadFilter(),g=a.ctx.createGain();
    const transient=a.ctx.createBufferSource(),trF=a.ctx.createBiquadFilter(),trG=a.ctx.createGain();
    src.buffer=nb;
    const trBuf=noiseBuffer(0.01,0.28,'white'); transient.buffer=trBuf;
    hp.type='highpass';hp.frequency.value=open?clamp(4800+hatTone*2400+(voice.brightness||0)*1200,3600,11000):clamp(6200+hatTone*2600+(voice.brightness||0)*800,5200,14000);
    bp.type='bandpass';bp.frequency.value=open?clamp(7200+hatTone*2500+(variation.variant?240:-80)+(voice.brightness||0)*1200,5600,13000):clamp(8600+hatTone*2200+(variation.variant?-260:160)+(voice.brightness||0)*900,7000,15000);bp.Q.value=open?(variation.variant?0.8:0.95):(variation.variant?1.0:1.36);
    air.type='highshelf';air.frequency.value=clamp(7200+hatTone*3000,6200,16000);air.gain.value=((variation.variant?2.2:1.5+energy*1.1)+(voice.air||0)*4+(drumFamilyCfg.air||0)*2)*ctxMod.airMul;
    trF.type='bandpass';trF.frequency.value=clamp(7000+(voice.brightness||0)*2400,5200,14000);trF.Q.value=1.2+(voice.air||0)*0.5;
    const decay=(open?0.042+drumDecay*0.18:0.006+drumDecay*0.028)*(voice.decay||1)*ctxMod.decayMul;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime((0.14+hatTone*0.13)*accent,t+0.0009);g.gain.exponentialRampToValueAtTime(0.001,t+decay);
    trG.gain.setValueAtTime(0,t);trG.gain.linearRampToValueAtTime((0.02+(voice.brightness||0)*0.03+(voice.air||0)*0.02)*accent*ctxMod.transientMul,t+0.0004);trG.gain.exponentialRampToValueAtTime(0.001,t+0.006+(voice.air||0)*0.004);
    src.connect(hp);hp.connect(bp);bp.connect(air);air.connect(g); transient.connect(trF); trF.connect(trG); trG.connect(g);
    const dest=getLaneGain('hat')||a.bus;const panNode=a.ctx.createStereoPanner?a.ctx.createStereoPanner():null; if(panNode){panNode.pan.value=clamp(((variation.variant?0.16:-0.16)+(open?0.06:-0.03))*((voice.pan||0.08)/0.08),-0.5,0.5);g.connect(panNode);panNode.connect(dest);}else{g.connect(dest);}
    gc(src,[hp,bp,air,g,transient,trF,trG],660);ss(src,t);ss(transient,t);st(src,t+(open?0.34*ctxMod.openMul:0.14));st(transient,t+0.012);
  };

  const getVoiceNotes=(baseNote,lane='synth')=>{
    const mode=MODES[modeName]||MODES.minor;
    const pool=lane==='bass'?mode.b:mode.s;
    const idx=pool.indexOf(baseNote);
    if(lane==='bass'){
      if(!bassStack)return [baseNote];
      const fifth=idx>-1?pool[Math.min(idx+4,pool.length-1)]:transposeNote(baseNote,7);
      const octave=idx>-1?pool[Math.min(idx+7,pool.length-1)]||fifth:fifth;
      return [...new Set([baseNote,fifth, rnd()<0.28?octave:null].filter(Boolean))];
    }
    if(!polySynth)return [baseNote];
    const spread=clamp((synthChordChanceRef.current||0.35)*0.8 + (synthHoldRef.current||0)*0.6,0,1.2);
    if(idx===-1)return [...new Set([baseNote,transposeNote(baseNote,4),transposeNote(baseNote,7), spread>0.72?transposeNote(baseNote,11):null].filter(Boolean))];
    return [...new Set(chooseChordVoicing(pool[idx],pool,spread,currentSectionNameRef.current||'groove',compositionEnergyRef.current).filter(Boolean))];
  };

  // ─── BASS SYNTHESIS ────────────────────────────────────────────────────────
  const playBassVoice=(note,accent,t,lenSteps=1)=>{
    if(!nodeGuard())return;
    const a=audioRef.current;
    const f=NOTE_FREQ[note]||110;
    const dur=clamp(stepSec()*lenSteps*0.92,0.04,6);
    const atk=Math.min(0.008,dur*0.05);
    const rel=Math.max(0.04,dur*0.88);
    const mode=bassPresetCfg.bassMode||GENRES[genre].bassMode||'sub';
    const charCfg=getCharacterConfig(soundCharacterRef.current);
    const energy=compositionEnergyRef.current;
    const g=a.ctx.createGain(),fil=a.ctx.createBiquadFilter();
    fil.type='lowpass';fil.frequency.setValueAtTime(60+(bassFilter+charCfg.bassFilterBias)*3000+(tone+charCfg.toneBias)*500+bassPresetCfg.bassPunch*500+energy*180,t);fil.frequency.linearRampToValueAtTime(clamp(110+(bassFilter+charCfg.bassFilterBias)*3600+(bassPresetCfg.bassMotion*540)+(tone+charCfg.toneBias)*380+energy*260,90,4200),t+Math.min(0.16,dur*0.34));fil.Q.value=0.45+compress*2.6+bassPresetCfg.bassMotion*1.2+energy*0.35;
    const bassPeak=0.46+bassPresetCfg.bassPunch*0.22;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(bassPeak*accent,t+atk);g.gain.setValueAtTime(bassPeak*accent,t+rel*(0.22+bassPresetCfg.bassPunch*0.18));g.gain.linearRampToValueAtTime((0.18+bassPresetCfg.bassPunch*0.08)*accent,t+rel*(0.56+bassPresetCfg.bassMotion*0.08));g.gain.exponentialRampToValueAtTime(0.0001,t+rel);
    const cleanMs=(rel+0.3)*1000;

    if(mode==='fm'||mode==='bit'){
      const idx=fmIdxRef.current*(mode==='bit'?3:1.5);
      const car=a.ctx.createOscillator(),mod=a.ctx.createOscillator(),mg=a.ctx.createGain();
      car.type='sine';car.frequency.value=f;mod.type='sine';mod.frequency.value=f*(mode==='fm'?2:3.2+bassPresetCfg.bassMotion*0.4);mg.gain.value=f*idx*(0.75+bassPresetCfg.bassPunch*0.35);
      const sub=a.ctx.createOscillator(),sg=a.ctx.createGain();
      sub.type='sine';sub.frequency.value=f*0.5;sg.gain.value=bassSubAmt*0.4;
      mod.connect(mg);mg.connect(car.frequency);car.connect(fil);sub.connect(sg);sg.connect(fil);fil.connect(g);
      const dest=getLaneGain('bass')||a.bus;g.connect(dest);trackNode(cleanMs);
      gc(car,[mod,mg,sub,sg,fil,g],cleanMs);
      ss(car,t);ss(mod,t);ss(sub,t);st(car,t+rel+0.05);st(mod,t+rel+0.05);st(sub,t+rel+0.05);
    } else if(mode==='fold'||mode==='wet'){
      const car=a.ctx.createOscillator(),ring=a.ctx.createOscillator(),rm=a.ctx.createGain();
      car.type='sawtooth';car.frequency.value=f;ring.type='sine';ring.frequency.value=f*(mode==='fold'?1.35+bassPresetCfg.bassMotion*0.4:0.7+bassPresetCfg.bassMotion*0.2);
      rm.gain.value=0.5;const rg=a.ctx.createGain();rg.gain.value=0;ring.connect(rg);rg.connect(rm.gain);
      car.connect(rm);rm.connect(fil);
      const sub=a.ctx.createOscillator(),sg=a.ctx.createGain();
      sub.type='sine';sub.frequency.value=f*0.5;sg.gain.value=bassSubAmt*0.5;
      sub.connect(sg);sg.connect(fil);fil.connect(g);
      const dest=getLaneGain('bass')||a.bus;g.connect(dest);trackNode(cleanMs);
      gc(car,[ring,rm,rg,sub,sg,fil,g],cleanMs);
      ss(car,t);ss(ring,t);ss(sub,t);st(car,t+rel+0.05);st(ring,t+rel+0.05);st(sub,t+rel+0.05);
    } else {
      const o1=a.ctx.createOscillator(),o2=a.ctx.createOscillator();
      const types={sub:'sine',grit:'sawtooth',drone:'sawtooth',saw:'sawtooth',pulse:'square'};
      o1.type=types[mode]||'sawtooth';o2.type='sine';
      o1.frequency.value=f;o2.frequency.value=f*(1+(bassPresetCfg.bassDetune??0.005));
      const sg=a.ctx.createGain();sg.gain.value=bassSubAmt*(mode==='sub'?0.85:0.3);
      const lfo=a.ctx.createOscillator(),lg=a.ctx.createGain();
      lfo.frequency.value=0.35+bassPresetCfg.bassMotion*0.9;lg.gain.value=mode==='drone'?18+bassPresetCfg.bassMotion*28:4+bassPresetCfg.bassMotion*10;
      lfo.connect(lg);lg.connect(fil.frequency);
      o1.connect(fil);o2.connect(sg);sg.connect(fil);fil.connect(g);
      const dest=getLaneGain('bass')||a.bus;g.connect(dest);trackNode(cleanMs);
      gc(o1,[o2,lfo,sg,fil,g,lg],cleanMs);
      ss(o1,t);ss(o2,t);ss(lfo,t);st(o1,t+rel+0.05);st(o2,t+rel+0.05);st(lfo,t+rel+0.05);
    }
    if(midiRef.current){const out=[...midiRef.current.outputs.values()][0];if(out){const v=Math.round(clamp(accent,0,1)*127);out.send([0x93,NOTE_MIDI[note]||48,v]);setTimeout(()=>out.send([0x83,NOTE_MIDI[note]||48,0]),rel*1000);}}
  };
  const playBass=(note,accent,t,lenSteps=1)=>{
    const notes=Array.isArray(note)?note:getVoiceNotes(note,'bass');
    const bassFamilyCfg=getSoundFamilyConfig('bass', getActiveSoundFamilies(compositionRef.current,genre).bass);
    const layered=[...notes];
    if((bassFamilyCfg.layer||0)>0.16 && notes[0]) layered.push(transposeNote(notes[0],12));
    const voiceAccent=accent/Math.sqrt(Math.max(1,layered.length));
    layered.forEach((voice,idx)=>playBassVoice(voice,voiceAccent*(idx===0?1:0.72),t+idx*0.002,lenSteps));
    setActiveNotes(p=>({...p,bass:notes.join(' · ')}));
  };

  // ─── SYNTH SYNTHESIS — extended with richer voices ───────────────────────
  const playSynthVoice=(note,accent,t,lenSteps=1,pan=0)=>{
    if(!nodeGuard())return;
    const a=audioRef.current;
    const f=NOTE_FREQ[note]||440;
    const baseDur=stepSec()*lenSteps*0.92;
    const mode=synthPresetCfg.synthMode||GENRES[genre].synthMode||'lead';
    const charCfg=getCharacterConfig(soundCharacterRef.current);
    const synthFamilyCfg=getSoundFamilyConfig('synth', getActiveSoundFamilies(compositionRef.current,genre).synth);
    const energy=compositionEnergyRef.current;
    const synthDetune=(synthPresetCfg.synthDetune??0.008)+(synthFamilyCfg.width||0)*0.01;
    const synthMotion=(synthPresetCfg.synthMotion??0.3)+(synthFamilyCfg.motion||0);
    const synthPunch=(synthPresetCfg.synthPunch??0.5)+Math.max(0,synthFamilyCfg.air||0)*0.1;
    const curve=synthCurveRef.current||'balanced';
    const holdBoost=1+synthHoldRef.current*(curve==='bloom'?1.35:curve==='soft'?1.12:curve==='snappy'?0.35:curve==='glass'?0.82:0.9);
    const dur=clamp(baseDur*holdBoost,0.05,10);
    const cleanMs=(dur+1.5)*1000;

    if(mode==='glass'||mode==='bell'){
      const atk=curve==='soft'?0.003:0.001,rel=Math.max(curve==='snappy'?0.22:0.3,dur*(curve==='bloom'?1.55:1.2)+synthFilter*(curve==='glass'?1.6:2));
      const nb=noiseBuffer(0.04,1,'white');
      const src=a.ctx.createBufferSource();src.buffer=nb;
      const dly=a.ctx.createDelay(0.05);dly.delayTime.value=1/f;
      const fbk=a.ctx.createGain();fbk.gain.value=0.94-synthFilter*0.12+synthMotion*0.04;
      const lpf=a.ctx.createBiquadFilter();lpf.type='lowpass';lpf.frequency.value=2000+synthFilter*6000;
      const amp=a.ctx.createGain();
      amp.gain.setValueAtTime(0,t);amp.gain.linearRampToValueAtTime((0.42+synthPunch*0.18)*accent,t+atk);amp.gain.exponentialRampToValueAtTime(0.001,t+rel);
      src.connect(dly);dly.connect(lpf);lpf.connect(fbk);fbk.connect(dly);lpf.connect(amp);
      const panNode=a.ctx.createStereoPanner?a.ctx.createStereoPanner():null; if(panNode){panNode.pan.value=clamp(pan,-0.55,0.55);amp.connect(panNode);(panNode).connect(getLaneGain('synth')||a.bus);}else{amp.connect(getLaneGain('synth')||a.bus);}trackNode(cleanMs);
      gc(src,[dly,lpf,fbk,amp],cleanMs);
      ss(src,t);st(src,t+0.04);
      return;
    }

    if(mode==='pad'||mode==='choir'||mode==='mist'){
      const atk=0.06+dur*0.08,rel=Math.max(atk+0.1,dur*0.9+space*0.5);
      const o1=a.ctx.createOscillator(),o2=a.ctx.createOscillator(),o3=a.ctx.createOscillator();
      o1.type='sawtooth';o2.type='sawtooth';o3.type='sine';
      o1.frequency.value=f;o2.frequency.value=f*(1+synthDetune);o3.frequency.value=f*(1-synthDetune*0.45);
      const mix=a.ctx.createGain();mix.gain.value=0.33;
      const fil=a.ctx.createBiquadFilter();fil.type='lowpass';
      fil.frequency.setValueAtTime(300+(synthFilter+charCfg.synthFilterBias)*2000+energy*120,t);
      fil.frequency.linearRampToValueAtTime(800+(synthFilter+charCfg.synthFilterBias)*5000+energy*260,t+atk*2);
      fil.Q.value=0.3+compress*1.4+synthMotion*0.8;
      const amp=a.ctx.createGain();
      amp.gain.setValueAtTime(0,t);amp.gain.linearRampToValueAtTime((0.28+synthPunch*0.14)*accent,t+atk);
      amp.gain.setValueAtTime((0.28+synthPunch*0.14)*accent,t+Math.max(atk+0.01,dur*(0.54+synthMotion*0.14)));
      amp.gain.exponentialRampToValueAtTime(0.001,t+rel);
      o1.connect(mix);o2.connect(mix);o3.connect(mix);mix.connect(fil);fil.connect(amp);
      const panNode=a.ctx.createStereoPanner?a.ctx.createStereoPanner():null; if(panNode){panNode.pan.value=clamp(pan,-0.55,0.55);amp.connect(panNode);(panNode).connect(getLaneGain('synth')||a.bus);}else{amp.connect(getLaneGain('synth')||a.bus);}trackNode(cleanMs);
      gc(o1,[o2,o3,mix,fil,amp],cleanMs);
      ss(o1,t);ss(o2,t);ss(o3,t);st(o1,t+rel+0.1);st(o2,t+rel+0.1);st(o3,t+rel+0.1);
      return;
    }

    if(mode==='organ'||mode==='air'){
      const atk=0.005,rel=Math.max(0.05,dur*0.95);
      const c1=a.ctx.createOscillator(),c2=a.ctx.createOscillator();
      const m1=a.ctx.createOscillator(),m2=a.ctx.createOscillator();
      const mg1=a.ctx.createGain(),mg2=a.ctx.createGain();
      c1.type='sine';c2.type='sine';m1.type='sine';m2.type='sine';
      c1.frequency.value=f;c2.frequency.value=f*2;m1.frequency.value=f*1;m2.frequency.value=f*3;
      mg1.gain.value=f*fmIdxRef.current*(0.55+synthPunch*0.45);mg2.gain.value=f*fmIdxRef.current*(0.24+synthMotion*0.22);
      m1.connect(mg1);mg1.connect(c1.frequency);
      m2.connect(mg2);mg2.connect(c2.frequency);
      const mix=a.ctx.createGain();mix.gain.value=0.5;
      const amp=a.ctx.createGain();
      amp.gain.setValueAtTime(0,t);amp.gain.linearRampToValueAtTime((0.3+synthPunch*0.16)*accent,t+atk);
      amp.gain.setValueAtTime((0.3+synthPunch*0.16)*accent,t+Math.max(atk+0.01,dur*(0.72+synthMotion*0.16)));
      amp.gain.exponentialRampToValueAtTime(0.001,t+rel);
      c1.connect(mix);c2.connect(mix);mix.connect(amp);
      const panNode=a.ctx.createStereoPanner?a.ctx.createStereoPanner():null; if(panNode){panNode.pan.value=clamp(pan,-0.55,0.55);amp.connect(panNode);(panNode).connect(getLaneGain('synth')||a.bus);}else{amp.connect(getLaneGain('synth')||a.bus);}trackNode(cleanMs);
      gc(c1,[c2,m1,m2,mg1,mg2,mix,amp],cleanMs);
      ss(c1,t);ss(c2,t);ss(m1,t);ss(m2,t);st(c1,t+rel+0.1);st(c2,t+rel+0.1);st(m1,t+rel+0.1);st(m2,t+rel+0.1);
      return;
    }

    if(mode==='strings'||mode==='star'){
      const atk=0.08+dur*0.06,rel=Math.max(atk+0.1,dur*0.92+space*0.4);
      const o1=a.ctx.createOscillator(),o2=a.ctx.createOscillator();
      const vib=a.ctx.createOscillator(),vg=a.ctx.createGain();
      o1.type='sawtooth';o2.type='sawtooth';
      o1.frequency.value=f;o2.frequency.value=f*(1+synthDetune*0.5);
      vib.frequency.value=4.6+rnd()*0.8+synthMotion*0.9+charCfg.motionBias*0.8;vg.gain.value=1.4+(synthFilter+charCfg.synthFilterBias)*5+synthMotion*2.6+energy*0.8;
      vib.connect(vg);vg.connect(o1.frequency);vg.connect(o2.frequency);
      const fil=a.ctx.createBiquadFilter();fil.type='lowpass';fil.frequency.value=400+synthFilter*5000;fil.Q.value=0.3;
      const amp=a.ctx.createGain();
      amp.gain.setValueAtTime(0,t);amp.gain.linearRampToValueAtTime((0.26+synthPunch*0.14)*accent,t+atk);
      amp.gain.setValueAtTime((0.26+synthPunch*0.14)*accent,t+Math.max(atk+0.01,dur*(0.62+synthMotion*0.16)));
      amp.gain.exponentialRampToValueAtTime(0.001,t+rel);
      o1.connect(fil);o2.connect(fil);fil.connect(amp);
      const panNode=a.ctx.createStereoPanner?a.ctx.createStereoPanner():null; if(panNode){panNode.pan.value=clamp(pan,-0.55,0.55);amp.connect(panNode);(panNode).connect(getLaneGain('synth')||a.bus);}else{amp.connect(getLaneGain('synth')||a.bus);}trackNode(cleanMs);
      gc(o1,[o2,vib,vg,fil,amp],cleanMs);
      ss(o1,t);ss(o2,t);ss(vib,t);st(o1,t+rel+0.1);st(o2,t+rel+0.1);st(vib,t+rel+0.1);
      return;
    }

    const atk=0.005,rel=Math.max(0.05,dur*0.9);
    const o1=a.ctx.createOscillator(),o2=a.ctx.createOscillator();
    const tmap={lead:'square',mist:'sawtooth',choir:'sine',star:'sine',glass:'sine',organ:'sine'};
    o1.type=tmap[mode]||'sawtooth';o2.type='triangle';
    o1.frequency.value=f;o2.frequency.value=f*(1+synthDetune*0.66);
    const vib=a.ctx.createOscillator(),vg=a.ctx.createGain();
    vib.frequency.value=4.8+synthMotion*1.4+charCfg.motionBias*0.9;vg.gain.value=clamp((mode==='lead'?6.5:2.4)+synthPunch*3.2+synthMotion*2+energy*1.2,0,15);
    vib.connect(vg);vg.connect(o1.frequency);
    const fil=a.ctx.createBiquadFilter();fil.type='lowpass';fil.frequency.value=200+(synthFilter+charCfg.synthFilterBias+(synthFamilyCfg.filter||0))*7000+(tone+charCfg.toneBias)*1200+energy*260;fil.Q.value=0.45+compress*2.6+synthPunch*0.8+energy*0.25;
    const amp=a.ctx.createGain();
    amp.gain.setValueAtTime(0,t);amp.gain.linearRampToValueAtTime((0.28+synthPunch*0.18)*accent,t+atk);
    amp.gain.setValueAtTime((0.28+synthPunch*0.18)*accent,t+Math.max(atk+0.01,dur*(0.58+synthMotion*0.14)));
    amp.gain.exponentialRampToValueAtTime(0.001,t+rel);
    const mix=a.ctx.createGain();mix.gain.value=0.5;
    const sheen=a.ctx.createBiquadFilter();sheen.type='highshelf';sheen.frequency.value=clamp(2600+(tone+charCfg.toneBias)*1800+synthMotion*900,1800,7200);sheen.gain.value=clamp((synthPunch-0.45)*6+energy*2.4,-2,5.5);
    o1.connect(mix);o2.connect(mix);mix.connect(fil);fil.connect(sheen);sheen.connect(amp);
    const panNode=a.ctx.createStereoPanner?a.ctx.createStereoPanner():null; if(panNode){panNode.pan.value=clamp(pan,-0.55,0.55);amp.connect(panNode);(panNode).connect(getLaneGain('synth')||a.bus);}else{amp.connect(getLaneGain('synth')||a.bus);}trackNode(cleanMs);
    gc(o1,[o2,vib,vg,mix,fil,sheen,amp],cleanMs);
    ss(o1,t);ss(o2,t);ss(vib,t);st(o1,t+rel+0.1);st(o2,t+rel+0.1);st(vib,t+rel+0.1);
    if(midiRef.current){const out=[...midiRef.current.outputs.values()][0];if(out){const v=Math.round(clamp(accent,0,1)*127);out.send([0x94,NOTE_MIDI[note]||60,v]);setTimeout(()=>out.send([0x84,NOTE_MIDI[note]||60,0]),rel*1000);}}
  };
  const playSynth=(note,accent,t,lenSteps=1)=>{
    const synthFamilyCfg=getSoundFamilyConfig('synth', getActiveSoundFamilies(compositionRef.current,genre).synth);
    let notes=Array.isArray(note)?note:getVoiceNotes(note,'synth');
    if(notes.length===1 && synthFamilyCfg.chord>0.14 && rnd()<0.22+synthChordChanceRef.current*0.16){
      notes=chooseChordVoicing(notes[0], (MODES[modeName]||MODES.minor).s, clamp(0.7+(synthFamilyCfg.width||0),0.7,1), currentSectionRef.current, compositionEnergyRef.current);
    }
    if(notes.length>1 && synthFamilyCfg.width>0.12){
      notes=notes.map((n,idx)=>idx===notes.length-1?transposeNote(n,12):n);
    }
    const voiceAccent=accent/Math.sqrt(Math.max(1,notes.length));
    notes.forEach((voice,idx)=>{
      const pan=notes.length===1?0:lerp(-0.32,0.32,notes.length===1?0.5:(idx/(notes.length-1)));
      playSynthVoice(voice,voiceAccent,t+idx*0.003,lenSteps,pan);
    });
    setActiveNotes(p=>({...p,synth:notes.join(' · ')}));
  };

  // ─── SCHEDULER ────────────────────────────────────────────────────────────
  const scheduleNote=(si,t)=>{
    const lp=patternsRef.current,ll=laneLenRef.current;
    if(si%16===0)transportBarRef.current+=1;
    const transportBar=transportBarRef.current;
    const accent=si%4===0?1:0.85;
    const charCfg=getCharacterConfig(soundCharacterRef.current);
    const runtimeEnergy=clamp(compositionEnergyRef.current*(0.94+((transportBar%4)/3)*0.08),0.1,1.1);
    for(const lane of['kick','snare','hat','bass','synth']){
      const len=ll[lane]||16;
      const li=si%len;
      const sd=lp[lane][li];
      const runtimeVar=lane==='kick'||lane==='snare'||lane==='hat'?drumRuntimeVariation(lane,si,transportBar):null;
      const shouldGhost=lane==='snare' && runtimeVar?.ghost && !sd?.on;
      const shouldExtra=runtimeVar?.extra && (lane==='hat'||lane==='snare'||lane==='kick');
      if((!sd||!sd.on) && !shouldGhost && !shouldExtra)continue;
      if(sd?.tied)continue;
      const laneProb=clamp(laneProbabilityRef.current[lane]??1,0,1);
      if((sd?.p<1&&rnd()>sd.p || laneProb<1&&rnd()>laneProb) && !shouldGhost && !shouldExtra)continue;
      const ga=grooveAccent(grooveProfileRef.current,lane,li,grooveRef.current);
      const laneEnergyBoost=lane==='kick'?0.04:lane==='bass'?0.03:lane==='synth'?0.02:0.01;
      const baseAccent=clamp(accent*ga*((sd?.v)||1)*(runtimeVar?.accentMul||1)*(0.96+runtimeEnergy*laneEnergyBoost+charCfg.accentBias),0.08,1.15);
      const hum=humanizeEvent(lane,si,transportBar,baseAccent);
      const noteT=t+Math.max(0,hum.jitter);
      const fa=hum.accent;
      if(lane==='kick'){
        if(sd?.on || shouldExtra)playKick(shouldExtra&&!sd?.on?fa*0.72:fa,noteT,{...hum,...runtimeVar,variant:hum.variant||((runtimeVar?.variantBias||0)>0.16?1:0)});
      }
      else if(lane==='snare'){
        if(sd?.on || shouldGhost || shouldExtra)playSnare(shouldGhost&&!sd?.on?fa*0.62:(shouldExtra&&!sd?.on?fa*0.78:fa),noteT,{...hum,...runtimeVar,ghost:shouldGhost&&!sd?.on,variant:hum.variant||((runtimeVar?.variantBias||0)>0.18?1:0)});
      }
      else if(lane==='hat'){
        const openBase=(li%16===7||li%16===15||si%32===0);
        const openChance=clamp((drumPresetCfg.hatOpenChance??0.12)+(runtimeVar?.openBias||0),0.04,0.42);
        const isOpen=openBase&&rnd()<openChance;
        if(sd?.on || shouldExtra)playHat(shouldExtra&&!sd?.on?fa*0.7:fa,noteT,isOpen,{...hum,...runtimeVar,variant:hum.variant||((runtimeVar?.variantBias||0)>0.14?1:0)});
      }
      else if(lane==='bass')playBass(bassRef.current[li]||'C2',fa,noteT,sd?.l||1);
      else if(lane==='synth')playSynth(synthRef.current[li]||'C4',fa,noteT,sd?.l||1);
      const delay=Math.max(0,(noteT-audioRef.current.ctx.currentTime)*1000);
      setTimeout(()=>flashLane(lane,fa),delay);
    }
    // Song arc — advance section every N bars
    if(si===0&&songActiveRef.current){
      barCountRef.current++;
      const arc=arcRef.current;
      if(arc.length>0){
        const sec=SECTIONS[arc[arcIdxRef.current]]||SECTIONS.groove;
        if(barCountRef.current>=sec.bars){
          barCountRef.current=0;
          const nextIdx=(arcIdxRef.current+1)%arc.length;
          arcIdxRef.current=nextIdx;
          setArcIdx(nextIdx);
          const nextSec=arc[nextIdx];
          setCurrentSectionName(nextSec);
          regenerateSection(nextSec,false);
        }
      }
    }
  };

  const stepInterval=si=>{
    const ms=(60/bpmRef.current)*1000/4;
    const sw=si%2===1?ms*swingRef.current:-ms*swingRef.current*0.5;
    return Math.max(0.028,(ms+sw)/1000);
  };

  const runScheduler=()=>{
    const a=audioRef.current;if(!a||!isPlayingRef.current)return;
    const now=a.ctx.currentTime;
    while(nextNoteRef.current<now+SCHED){
      const si=stepRef.current;
      scheduleNote(si,nextNoteRef.current);
      const delay=Math.max(0,(nextNoteRef.current-now)*1000);
      setTimeout(()=>{setStep(si);setPage(Math.floor(si/PAGE));},delay);
      nextNoteRef.current+=stepInterval(si);
      stepRef.current=(si+1)%MAX_STEPS;
    }
  };

  // ─── TRANSPORT ────────────────────────────────────────────────────────────
  const startClock=()=>{
    const a=audioRef.current;if(!a)return;
    nextNoteRef.current=a.ctx.currentTime+0.06;
    stepRef.current=0;transportBarRef.current=0;isPlayingRef.current=true;
    schedulerRef.current=setInterval(runScheduler,LOOK);
  };
  const stopClock=()=>{
    if(schedulerRef.current){clearInterval(schedulerRef.current);schedulerRef.current=null;}
    isPlayingRef.current=false;setIsPlaying(false);setStep(0);
  };
  const togglePlay=async()=>{
    await initAudio();if(!audioRef.current)return;
    if(isPlayingRef.current){stopClock();setStatus('Stopped');return;}
    if(audioRef.current.ctx.state==='suspended')await audioRef.current.ctx.resume();
    startClock();setIsPlaying(true);setStatus(`Playing — ${genre} · ${currentSectionName}`);
  };

  // ─── GENERATION ───────────────────────────────────────────────────────────
  const regenerateSection=(sectionName,pushUndo_=true)=>{
    const gd=GENRES[genre];
    const mName=modeName;
    const prog=progressionRef.current;
    const aMode=arpModeRef.current;
    const lb=lastBassRef.current;
    let result=buildSection(genre,sectionName||currentSectionName,mName,prog,aMode,lb,compositionRef.current,compositionCycleRef.current);
    result=preserveLockedLanes(result,patternsRef.current,bassRef.current,synthRef.current,patternAuthorityRef.current);
    compositionCycleRef.current+=1;
    setSoundCharacter(result.soundCharacter||compositionRef.current?.soundCharacter||getGenreSoundCharacter(genre));
    soundCharacterRef.current=result.soundCharacter||compositionRef.current?.soundCharacter||getGenreSoundCharacter(genre);
    setCompositionEnergy(result.macroEnergy||computeMacroEnergy(sectionName||currentSectionName,compositionRef.current,compositionCycleRef.current,0));
    compositionEnergyRef.current=result.macroEnergy||computeMacroEnergy(sectionName||currentSectionName,compositionRef.current,compositionCycleRef.current,0);
    if(pushUndo_)pushUndo();
    setPatterns(result.patterns);
    setBassLine(result.bassLine);
    setSynthLine(result.synthLine);
    setLaneLen(result.laneLen);
    lastBassRef.current=result.lastBass;
    patternsRef.current=result.patterns;
    bassRef.current=result.bassLine;
    synthRef.current=result.synthLine;
    laneLenRef.current=result.laneLen;
    const gp=gd.density>0.65&&gd.chaos>0.4?'bunker':gd.chaos>0.6?'broken':gd.density<0.4?'float':'steady';
    setGrooveProfile(gp);grooveProfileRef.current=gp;
    setStatus(`${genre} · ${sectionName||currentSectionName} · ${mName}`);
  };

  const newGenreSession=(g)=>{
    const gd=GENRES[g];
    const mName=pick(gd.modes);
    const pp=CHORD_PROGS[mName]||CHORD_PROGS.minor;
    const prog=pick(pp);
    const aMode=pick(['up','down','updown','outside']);
    compositionRef.current=createCompositionBlueprint(g,mName,prog,aMode);
    compositionCycleRef.current=0;
    setSoundCharacter(compositionRef.current.soundCharacter||getGenreSoundCharacter(g));
    soundCharacterRef.current=compositionRef.current.soundCharacter||getGenreSoundCharacter(g);
    setGenre(g);setModeName(mName);setArpMode(aMode);
    progressionRef.current=prog;arpModeRef.current=aMode;
    setBpm(Math.round(gd.bpm[0]+rnd()*(gd.bpm[1]-gd.bpm[0])));
    bpmRef.current=Math.round(gd.bpm[0]+rnd()*(gd.bpm[1]-gd.bpm[0]));
    setSpace(gd.fxProfile.space);setTone(gd.fxProfile.tone);setDrive(gd.fxProfile.drive*2);
    setNoiseMix(gd.chaos*0.4);setCompress(gd.density*0.4);
    const sec=pick(Object.keys(SECTIONS));
    setCurrentSectionName(sec);
    lastBassRef.current='C2';
    let result=buildSection(g,sec,mName,prog,aMode,'C2',compositionRef.current,compositionCycleRef.current);
    result=preserveLockedLanes(result,patternsRef.current,bassRef.current,synthRef.current,patternAuthorityRef.current);
    compositionCycleRef.current+=1;
    setCompositionEnergy(result.macroEnergy||computeMacroEnergy(sec,compositionRef.current,compositionCycleRef.current,0));
    compositionEnergyRef.current=result.macroEnergy||computeMacroEnergy(sec,compositionRef.current,compositionCycleRef.current,0);
    setPatterns(result.patterns);setBassLine(result.bassLine);setSynthLine(result.synthLine);setLaneLen(result.laneLen);
    patternsRef.current=result.patterns;bassRef.current=result.bassLine;synthRef.current=result.synthLine;laneLenRef.current=result.laneLen;
    lastBassRef.current=result.lastBass;
    const gp=gd.density>0.65&&gd.chaos>0.4?'bunker':gd.chaos>0.6?'broken':gd.density<0.4?'float':'steady';
    setGrooveProfile(gp);grooveProfileRef.current=gp;
    applyFxNow();
    setStatus(`${g} loaded — ${sec} · ${mName}`);
  };

  // Section jump trigger
  const triggerSection=(sec)=>{
    setCurrentSectionName(sec);regenerateSection(sec);
  };

  // Live performance actions
  const perfActions={
    drop:()=>triggerSection('drop'),
    break:()=>triggerSection('break'),
    build:()=>triggerSection('build'),
    groove:()=>triggerSection('groove'),
    tension:()=>triggerSection('tension'),
    fill:()=>triggerSection('fill'),
    intro:()=>triggerSection('intro'),
    outro:()=>triggerSection('outro'),
    reharmonize:()=>{
      const pp=CHORD_PROGS[modeName]||CHORD_PROGS.minor;
      progressionRef.current=pick(pp);
      compositionRef.current=createCompositionBlueprint(genre,modeName,progressionRef.current,arpModeRef.current);
      compositionCycleRef.current=0;
      regenerateSection(currentSectionName);
      setStatus('Reharmonized');
    },
    mutate:()=>{
      pushUndo();
      const np={...patternsRef.current};
      ['kick','snare','hat','bass','synth'].forEach(ln=>{
        const ll=laneLenRef.current[ln]||16;
        const flips=Math.max(2,Math.floor(ll*0.08));
        np[ln]=np[ln].map(s=>({...s}));
        for(let i=0;i<flips;i++){const pos=Math.floor(rnd()*ll);if(pos%4!==0||ln!=='kick')np[ln][pos].on=!np[ln][pos].on;}
      });
      const safe=mergeProtectedMutation(np,patternsRef.current,patternAuthorityRef.current);
      setPatterns(safe);patternsRef.current=safe;
      setStatus('Pattern mutated');
    },
    thinOut:()=>{
      pushUndo();
      const np={...patternsRef.current};
      ['hat','synth','bass'].forEach(ln=>{
        const ll=laneLenRef.current[ln]||16;
        np[ln]=np[ln].map((s,i)=>({...s,on:s.on&&(i%4===0||rnd()>0.45)}));
      });
      const safe=mergeProtectedMutation(np,patternsRef.current,patternAuthorityRef.current);
      setPatterns(safe);patternsRef.current=safe;
      setStatus('Thinned out');
    },
    thicken:()=>{
      pushUndo();
      const np={...patternsRef.current};
      ['hat','kick'].forEach(ln=>{
        const ll=laneLenRef.current[ln]||16;
        np[ln]=np[ln].map((s,i)=>({...s,on:s.on||(rnd()<0.22),v:s.v||0.65,p:s.p||0.7}));
      });
      const safe=mergeProtectedMutation(np,patternsRef.current,patternAuthorityRef.current);
      setPatterns(safe);patternsRef.current=safe;
      setStatus('Thickened');
    },
    randomizeNotes:()=>{
      // Randomize synth line within current mode's scale
      const mode=MODES[modeName]||MODES.minor;
      const sp=mode.s;
      if(patternAuthorityRef.current.synth==='lock'){setStatus('Synth locked');return;}
      pushUndo();
      setSynthLine(prev=>{const n=prev.map((v,i)=>patterns.synth[i]?.on?pick(sp):v);synthRef.current=n;return n;});
      setStatus('Synth notes randomized');
    },
    randomizeBass:()=>{
      const mode=MODES[modeName]||MODES.minor;
      const bp=mode.b;
      if(patternAuthorityRef.current.bass==='lock'){setStatus('Bass locked');return;}
      pushUndo();
      setBassLine(prev=>{const n=prev.map((v,i)=>patterns.bass[i]?.on?pick(bp):v);bassRef.current=n;return n;});
      setStatus('Bass notes randomized');
    },
    shiftNotesUp:()=>{
      const mode=MODES[modeName]||MODES.minor;
      ['bass','synth'].forEach(lane=>{
        const pool=lane==='bass'?mode.b:mode.s;
        if(lane==='bass')setBassLine(prev=>{const n=prev.map((v,i)=>{if(!patterns[lane][i]?.on)return v;const idx=pool.indexOf(v);return pool[Math.min(idx+1,pool.length-1)];});bassRef.current=n;return n;});
        else setSynthLine(prev=>{const n=prev.map((v,i)=>{if(!patterns[lane][i]?.on)return v;const idx=pool.indexOf(v);return pool[Math.min(idx+1,pool.length-1)];});synthRef.current=n;return n;});
      });
      setStatus('Notes shifted up');
    },
    shiftNotesDown:()=>{
      const mode=MODES[modeName]||MODES.minor;
      ['bass','synth'].forEach(lane=>{
        const pool=lane==='bass'?mode.b:mode.s;
        if(lane==='bass')setBassLine(prev=>{const n=prev.map((v,i)=>{if(!patterns[lane][i]?.on)return v;const idx=pool.indexOf(v);return pool[Math.max(idx-1,0)];});bassRef.current=n;return n;});
        else setSynthLine(prev=>{const n=prev.map((v,i)=>{if(!patterns[lane][i]?.on)return v;const idx=pool.indexOf(v);return pool[Math.max(idx-1,0)];});synthRef.current=n;return n;});
      });
      setStatus('Notes shifted down');
    },
    shiftArp:()=>{
      const modes=['up','down','updown','outside'];
      const next=modes[(modes.indexOf(arpModeRef.current)+1)%modes.length];
      setArpMode(next);arpModeRef.current=next;
      compositionRef.current=createCompositionBlueprint(genre,modeName,progressionRef.current,next);
      compositionCycleRef.current=0;
      regenerateSection(currentSectionName);
      setStatus(`Arp → ${next}`);
    },
    clear:()=>clearPattern(),
  };

  // ─── AUTOPILOT ────────────────────────────────────────────────────────────
  const runAutopilot=useCallback(()=>{
    if(!autopilotRef.current)return;
    const intensity=autopilotIntensity;
    const actions=Object.keys(perfActions);
    const r=rnd();
    if(r<0.25*intensity)perfActions.mutate();
    else if(r<0.4*intensity)perfActions.shiftArp();
    else if(r<0.55)regenerateSection(currentSectionName);
    else if(r<0.65*intensity)perfActions.thinOut();
    else if(r<0.75*intensity)perfActions.thicken();
    else if(r<0.82)perfActions.reharmonize();
    // Section changes with lower probability
    if(rnd()<0.15*intensity){
      const sections=Object.keys(SECTIONS);
      triggerSection(pick(sections));
    }
    const nextDelay=(8+rnd()*16)*(1-intensity*0.4)*1000*(240/bpm);
    autopilotTimerRef.current=setTimeout(runAutopilot,nextDelay);
  },[autopilotIntensity,currentSectionName,genre,bpm]);

  useEffect(()=>{
    if(autopilot){
      setStatus('Autopilot engaged');
      const delay=(4+rnd()*8)*1000*(240/bpm);
      autopilotTimerRef.current=setTimeout(runAutopilot,delay);
    } else {
      if(autopilotTimerRef.current)clearTimeout(autopilotTimerRef.current);
      setStatus('Autopilot off');
    }
    return()=>{if(autopilotTimerRef.current)clearTimeout(autopilotTimerRef.current);};
  },[autopilot,runAutopilot]);

  // ─── SONG ARC ─────────────────────────────────────────────────────────────
  const startSongArc=()=>{
    const song=buildSong(genre);
    compositionRef.current=song.composition;
    compositionCycleRef.current=0;
    progressionRef.current=song.progression;
    arpModeRef.current=song.arpeMode;
    setModeName(song.modeName);
    setArpMode(song.arpeMode);
    setBpm(song.bpm);bpmRef.current=song.bpm;
    setSongArc(song.arc);arcRef.current=song.arc;
    setArcIdx(0);arcIdxRef.current=0;
    barCountRef.current=0;
    setSongActive(true);songActiveRef.current=true;
    setCurrentSectionName(song.arc[0]);
    setTimeout(()=>regenerateSection(song.arc[0]),0);
    setStatus(`Song arc started: ${song.arc.join(' → ')}`);
  };
  const stopSongArc=()=>{
    setSongActive(false);songActiveRef.current=false;
    setStatus('Song arc stopped');
  };

  // ─── UNDO/REDO ────────────────────────────────────────────────────────────
  const pushUndo=()=>{
    const snap={patterns:{...patternsRef.current},bassLine:[...bassRef.current],synthLine:[...synthRef.current]};
    undoStack.current=[snap,...undoStack.current.slice(0,UNDO-1)];
    setUndoLen(undoStack.current.length);
  };
  const undo=()=>{
    if(!undoStack.current.length)return;
    const snap=undoStack.current.shift();setUndoLen(undoStack.current.length);
    setPatterns(snap.patterns);setBassLine(snap.bassLine);setSynthLine(snap.synthLine);
    patternsRef.current=snap.patterns;bassRef.current=snap.bassLine;synthRef.current=snap.synthLine;
    setStatus('Undo');
  };

  // ─── SAVE/LOAD ────────────────────────────────────────────────────────────
  const serialize=()=>({
    v:5,genre,modeName,bpm,currentSectionName,grooveProfile,arpMode:arpModeRef.current,progression:progressionRef.current,
    space,tone,noiseMix,drive,compress,bassFilter,synthFilter,drumDecay,bassSubAmt,fmIdx,
    master,swing,humanize,grooveAmt,projectName,polySynth,bassStack,bassPreset,synthPreset,drumPreset,performancePreset,soundCharacter,compositionEnergy,patternAuthority,laneVolume,laneProbability,synthChordChance,synthHold,synthCurve,genreFamily:compositionRef.current?.genreFamily||getGenreFamilyProfile(genre),soundFamilies:compositionRef.current?.soundFamilies||getGenreSoundFamilies(genre),primaryMotifs:compositionRef.current?.primaryMotifs||null,
    patterns,bassLine,synthLine,laneLen,
  });
  const applySnap=(snap)=>{
    if(!snap||(snap.v!==2&&snap.v!==3&&snap.v!==4&&snap.v!==5))return;
    stopClock();
    setGenre(snap.genre||'acid');setModeName(snap.modeName||'minor');setBpm(snap.bpm||128);bpmRef.current=snap.bpm||128;
    progressionRef.current=snap.progression||progressionRef.current;
    setCurrentSectionName(snap.currentSectionName||'groove');setGrooveProfile(snap.grooveProfile||'steady');
    setArpMode(snap.arpMode||'up');arpModeRef.current=snap.arpMode||'up';
    compositionRef.current=createCompositionBlueprint(snap.genre||'acid',snap.modeName||'minor',progressionRef.current,arpModeRef.current);
    compositionRef.current.soundCharacter=snap.soundCharacter||compositionRef.current.soundCharacter||getGenreSoundCharacter(snap.genre||'acid');
    compositionRef.current.soundFamilies=snap.soundFamilies||compositionRef.current.soundFamilies||getGenreSoundFamilies(snap.genre||'acid');
    compositionRef.current.primaryMotifs=snap.primaryMotifs||compositionRef.current.primaryMotifs||compositionRef.current?.primaryMotifs||null;
    compositionRef.current.genreFamily=snap.genreFamily||compositionRef.current.genreFamily||getGenreFamilyProfile(snap.genre||'acid');
    compositionCycleRef.current=0;
    setSpace(snap.space??0.3);setTone(snap.tone??0.7);setNoiseMix(snap.noiseMix??0.2);setDrive(snap.drive??0.1);
    setCompress(snap.compress??0.3);setBassFilter(snap.bassFilter??0.55);setSynthFilter(snap.synthFilter??0.65);
    setDrumDecay(snap.drumDecay??0.5);setBassSubAmt(snap.bassSubAmt??0.5);setFmIdx(snap.fmIdx??0.6);
    setMaster(snap.master??0.85);setSwing(snap.swing??0.03);setHumanize(snap.humanize??0.012);setGrooveAmt(snap.grooveAmt??0.65);setPolySynth(snap.polySynth??true);setBassStack(snap.bassStack??true);setBassPreset(snap.bassPreset??'sub_floor');setSynthPreset(snap.synthPreset??'velvet_pad');setDrumPreset(snap.drumPreset??'tight_punch');setPerformancePreset(snap.performancePreset??'club_night');setSoundCharacter(snap.soundCharacter??compositionRef.current.soundCharacter??getGenreSoundCharacter(snap.genre||'acid'));soundCharacterRef.current=snap.soundCharacter??compositionRef.current.soundCharacter??getGenreSoundCharacter(snap.genre||'acid');setCompositionEnergy(snap.compositionEnergy??0.68);compositionEnergyRef.current=snap.compositionEnergy??0.68;const nextAuthority={...defaultPatternAuthority(),...(snap.patternAuthority||{})};setPatternAuthority(nextAuthority);patternAuthorityRef.current=nextAuthority;const nextLaneVolume={...defaultLaneVolume(),...(snap.laneVolume||{})};setLaneVolume(nextLaneVolume);laneVolumeRef.current=nextLaneVolume;const nextLaneProbability={...defaultLaneProbability(),...(snap.laneProbability||{})};setLaneProbability(nextLaneProbability);laneProbabilityRef.current=nextLaneProbability;const nextSynthChordChance=snap.synthChordChance??0.34;setSynthChordChance(nextSynthChordChance);synthChordChanceRef.current=nextSynthChordChance;const nextSynthHold=snap.synthHold??0.56;setSynthHold(nextSynthHold);synthHoldRef.current=nextSynthHold;const nextSynthCurve=SYNTH_CURVES.includes(snap.synthCurve)?snap.synthCurve:'balanced';setSynthCurve(nextSynthCurve);synthCurveRef.current=nextSynthCurve;
    if(snap.projectName)setProjectName(snap.projectName);
    if(snap.patterns){setPatterns(snap.patterns);patternsRef.current=snap.patterns;}
    if(snap.bassLine){setBassLine(snap.bassLine);bassRef.current=snap.bassLine;}
    if(snap.synthLine){setSynthLine(snap.synthLine);synthRef.current=snap.synthLine;}
    if(snap.laneLen){setLaneLen(snap.laneLen);laneLenRef.current=snap.laneLen;}
    setStatus('Scene loaded');
  };
  const saveScene=slot=>{setSavedScenes(p=>p.map((v,i)=>i===slot?{...serialize(),label:`S${slot+1} ${new Date().toLocaleTimeString()}`}:v));setStatus(`Scene ${slot+1} saved`);};
  const loadScene=slot=>{if(savedScenes[slot])applySnap(savedScenes[slot]);};
  const exportJSON=()=>{const b=new Blob([JSON.stringify(serialize(),null,2)],{type:'application/json'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`${projectName.replace(/\s+/g,'-').toLowerCase()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),500);setStatus('Exported');};
  const importRef=useRef(null);
  const importJSON=async e=>{const f=e.target.files?.[0];if(!f)return;try{const t=await f.text();applySnap(JSON.parse(t));}catch{setStatus('Import failed');}finally{e.target.value='';}};

  // ─── RECORDING ────────────────────────────────────────────────────────────
  const startRec=async()=>{
    await initAudio();const a=audioRef.current;if(!a||recState==='recording')return;
    const mimes=['audio/webm;codecs=opus','audio/webm','audio/mp4'];
    const mime=mimes.find(m=>MediaRecorder.isTypeSupported?.(m))||'';
    chunksRef.current=[];
    const rec=mime?new MediaRecorder(a.dest.stream,{mimeType:mime}):new MediaRecorder(a.dest.stream);
    recorderRef.current=rec;
    rec.ondataavailable=e=>{if(e.data?.size>0)chunksRef.current.push(e.data);};
    rec.onstop=()=>{
      const ft=mime||rec.mimeType||'audio/webm';const ext=ft.includes('mp4')?'m4a':'webm';
      const blob=new Blob(chunksRef.current,{type:ft});
      const url=URL.createObjectURL(blob);
      setRecordings(p=>[{url,name:`${projectName.replace(/\s+/g,'-')}-take-${p.length+1}.${ext}`,time:new Date().toLocaleTimeString()},...p.slice(0,7)]);
      setRecState('idle');setStatus('Take saved');
    };
    rec.start();setRecState('recording');setStatus('● REC');
  };
  const stopRec=()=>{if(recorderRef.current&&recState==='recording'){recorderRef.current.stop();setRecState('stopping');}};

  // ─── TAP TEMPO ────────────────────────────────────────────────────────────
  const tapTempo=()=>{
    const now=Date.now();
    setTapTimes(prev=>{
      const next=[...prev.filter(t=>now-t<3000),now];
      if(next.length>=2){const intervals=next.slice(1).map((t,i)=>t-next[i]);const avg=intervals.reduce((a,b)=>a+b,0)/intervals.length;const nb=clamp(Math.round(60000/avg),40,250);setBpm(nb);bpmRef.current=nb;setStatus(`TAP → ${nb} BPM`);}
      return next.slice(-6);
    });
  };

  const applyPartialPreset=(preset)=>{
    if(!preset)return;
    if(preset.genre&&preset.genre!==genre)newGenreSession(preset.genre);
    if(preset.bassMode){
      const next={...GENRES[genre],bassMode:preset.bassMode};
      GENRES[genre]=next;
    }
    if(preset.synthMode){
      const next={...GENRES[genre],synthMode:preset.synthMode};
      GENRES[genre]=next;
    }
    if(preset.space!==undefined)setSpace(preset.space);
    if(preset.tone!==undefined)setTone(preset.tone);
    if(preset.drive!==undefined)setDrive(preset.drive);
    if(preset.compress!==undefined)setCompress(preset.compress);
    if(preset.noiseMix!==undefined)setNoiseMix(preset.noiseMix);
    if(preset.drumDecay!==undefined)setDrumDecay(preset.drumDecay);
    if(preset.bassFilter!==undefined)setBassFilter(preset.bassFilter);
    if(preset.synthFilter!==undefined)setSynthFilter(preset.synthFilter);
    if(preset.bassSubAmt!==undefined)setBassSubAmt(preset.bassSubAmt);
    if(preset.fmIdx!==undefined){setFmIdx(preset.fmIdx);fmIdxRef.current=preset.fmIdx;}
    if(preset.polySynth!==undefined)setPolySynth(preset.polySynth);
    if(preset.bassStack!==undefined)setBassStack(preset.bassStack);
    if(preset.grooveAmt!==undefined){setGrooveAmt(preset.grooveAmt);grooveRef.current=preset.grooveAmt;}
    if(preset.swing!==undefined){setSwing(preset.swing);swingRef.current=preset.swing;}
  };

  const applyBassPreset=(key)=>{
    const preset=SOUND_PRESETS.bass[key];
    if(!preset)return;
    setBassPreset(key);
    applyPartialPreset({...preset});
    setStatus(`Bass preset — ${preset.label}`);
  };
  const applySynthPreset=(key)=>{
    const preset=SOUND_PRESETS.synth[key];
    if(!preset)return;
    setSynthPreset(key);
    applyPartialPreset({...preset});
    setStatus(`Synth preset — ${preset.label}`);
  };
  const applyDrumPreset=(key)=>{
    const preset=SOUND_PRESETS.drum[key];
    if(!preset)return;
    setDrumPreset(key);
    applyPartialPreset({...preset});
    setStatus(`Drum preset — ${preset.label}`);
  };
  const applyPerformancePreset=(key)=>{
    const preset=SOUND_PRESETS.performance[key];
    if(!preset)return;
    setPerformancePreset(key);
    applyPartialPreset({...preset});
    setStatus(`Performance preset — ${preset.label}`);
  };

  const clearPattern=()=>{
    pushUndo();
    const mode=MODES[modeName]||MODES.minor;
    const empty={kick:mkSteps(),snare:mkSteps(),hat:mkSteps(),bass:mkSteps(),synth:mkSteps()};
    setPatterns(empty);patternsRef.current=empty;
    const newBass=mkNotes(mode.b[0]||'C2');
    const newSynth=mkNotes(mode.s[0]||'C4');
    setBassLine(newBass);bassRef.current=newBass;
    setSynthLine(newSynth);synthRef.current=newSynth;
    setStatus('Pattern cleared');
  };

  // ─── STEP EDIT ────────────────────────────────────────────────────────────
  const toggleCell=(lane,idx)=>{
    pushUndo();
    setAuthorityForLane(lane,'lock');
    setPatterns(p=>{const n={...p,[lane]:p[lane].map((s,i)=>i===idx?{...s,on:!s.on}:s)};patternsRef.current=n;return n;});
    setStatus(`${laneAuthorityKey(lane).toUpperCase()} locked to your pattern`);
  };
  const setNote=(lane,idx,note)=>{
    setAuthorityForLane(lane,'lock');
    if(lane==='bass')setBassLine(p=>{const n=[...p];n[idx]=note;bassRef.current=n;return n;});
    else setSynthLine(p=>{const n=[...p];n[idx]=note;synthRef.current=n;return n;});
    setStatus(`${lane.toUpperCase()} locked to your notes`);
  };

  // ─── MIDI ─────────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!navigator.requestMIDIAccess)return;
    navigator.requestMIDIAccess().then(m=>{midiRef.current=m;setMidiOk(true);}).catch(()=>{});
  },[]);

  // ─── KEYBOARD SHORTCUTS ───────────────────────────────────────────────────
  useEffect(()=>{
    const onKey=e=>{
      if(e.target.tagName==='INPUT')return;
      if(e.code==='Space'){e.preventDefault();togglePlay();}
      else if(e.code==='KeyA')perfActions.drop();
      else if(e.code==='KeyS')perfActions.break();
      else if(e.code==='KeyD')perfActions.build();
      else if(e.code==='KeyF')perfActions.groove();
      else if(e.code==='KeyG')perfActions.tension();
      else if(e.code==='KeyH')perfActions.fill();
      else if(e.code==='KeyM')perfActions.mutate();
      else if(e.code==='KeyR')regenerateSection(currentSectionName);
      else if(e.code==='KeyP')setAutopilot(v=>!v);
      else if(e.code==='KeyZ'&&(e.metaKey||e.ctrlKey))undo();
      else if(e.code==='KeyT')tapTempo();
    };
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[currentSectionName,genre]);

  // ─── VISUALIZER ───────────────────────────────────────────────────────────
  const vizRef=useRef(null);
  useEffect(()=>{
    let rafId;
    const draw=()=>{
      rafId=requestAnimationFrame(draw);
      const an=analyserRef.current;if(!an||!vizRef.current)return;
      const data=new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(data);setVizData(data);
      const canvas=vizRef.current;const ctx=canvas.getContext('2d');
      const W=canvas.width,H=canvas.height;
      ctx.clearRect(0,0,W,H);
      const gc=GENRE_CLR[genre]||'#ff4444';
      const barW=W/data.length;
      for(let i=0;i<data.length;i++){
        const v=(data[i]/255)*H;
        const alpha=0.3+v/H*0.7;
        ctx.fillStyle=`${gc}${Math.round(alpha*255).toString(16).padStart(2,'0')}`;
        ctx.fillRect(i*barW,H-v,barW-0.5,v);
      }
    };
    draw();
    return()=>cancelAnimationFrame(rafId);
  },[genre]);

  // ─── INIT ─────────────────────────────────────────────────────────────────
  useEffect(()=>{
    newGenreSession('acid');
    setTimeout(()=>{applyBassPreset('sub_floor');applySynthPreset('velvet_pad');applyDrumPreset('tight_punch');applyPerformancePreset('club_night');},0);
  },[]);

  // ─── RENDER HELPERS ───────────────────────────────────────────────────────
  const gc_=GENRE_CLR[genre]||'#ff4444';
  const visibleSteps=Array.from({length:PAGE},(_,i)=>page*PAGE+i);
  const [viewportWidth,setViewportWidth]=useState(typeof window!=='undefined'?window.innerWidth:1280);
  useEffect(()=>{
    const onResize=()=>setViewportWidth(window.innerWidth);
    window.addEventListener('resize',onResize);
    return()=>window.removeEventListener('resize',onResize);
  },[]);
  const isCompact=viewportWidth<1180;
  const isPhone=viewportWidth<820;

  // ─── UI ───────────────────────────────────────────────────────────────────
  return(
    <div style={{
      width:'100vw',height:'100dvh',background:'#060608',color:'#e8e8e8',
      fontFamily:"'Space Mono',monospace",display:'flex',flexDirection:'column',
      overflow:'hidden',userSelect:'none',position:'relative',
      boxSizing:'border-box',minWidth:0,
    }}>

      {/* ── SCANLINE OVERLAY ── */}
      <div style={{position:'fixed',inset:0,backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.08) 2px,rgba(0,0,0,0.08) 4px)',pointerEvents:'none',zIndex:999}}/>

      {/* ── TOP BAR ── */}
      <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:6,padding:isPhone?'8px':'6px 10px',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0,minHeight:36,background:'rgba(0,0,0,0.4)',overflow:'hidden'}}>
        {/* Logo */}
        <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.22em',color:gc_,borderRadius:3,padding:'2px 6px',border:`1px solid ${gc_}44`,whiteSpace:'nowrap'}}>
          CESIRA V2
        </div>

        {/* Project name */}
        <input value={projectName} onChange={e=>setProjectName(e.target.value)}
          style={{background:'transparent',border:'none',outline:'none',color:'rgba(255,255,255,0.96)',fontSize:8.5,fontFamily:'Space Mono,monospace',letterSpacing:'0.08em',width:isPhone?'100%':110,flex:isPhone?1:'0 0 auto',minWidth:isPhone?160:110}}/>

        {/* Genre selector */}
        <div style={{display:'flex',gap:2,flexShrink:0,flexWrap:'wrap',maxWidth:isPhone?'100%':'none'}}>
          {GENRE_NAMES.map(g=>(
            <button key={g} onClick={()=>newGenreSession(g)} style={{
              padding:'2px 5px',borderRadius:2,border:`1px solid ${genre===g?GENRE_CLR[g]:'rgba(255,255,255,0.07)'}`,
              background:genre===g?`${GENRE_CLR[g]}18`:'transparent',
              color:genre===g?GENRE_CLR[g]:'rgba(255,255,255,0.93)',
              fontSize:7.75,fontWeight:700,cursor:'pointer',letterSpacing:'0.1em',
              fontFamily:'Space Mono,monospace',textTransform:'uppercase',
              transition:'all 0.1s',
            }}>{g}</button>
          ))}
        </div>

        <div style={{flex:1}}/>

        {/* Visualizer */}
        {!isPhone&&<canvas ref={vizRef} width={96} height={18} style={{opacity:0.65,borderRadius:2}}/>}

        {/* BPM — proper control with +/- and slider */}
        <div style={{display:'flex',alignItems:'center',gap:2,background:'rgba(255,255,255,0.05)',borderRadius:4,padding:'2px 4px',border:'1px solid rgba(255,255,255,0.1)'}}>
          <button onClick={()=>{const v=clamp(bpm-5,40,250);setBpm(v);bpmRef.current=v;}} style={{width:16,height:16,borderRadius:2,border:'none',background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.6)',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Space Mono,monospace',lineHeight:1,flexShrink:0}}>−</button>
          <button onClick={()=>{const v=clamp(bpm-1,40,250);setBpm(v);bpmRef.current=v;}} style={{width:14,height:16,borderRadius:2,border:'none',background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.97)',fontSize:8.5,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Space Mono,monospace',lineHeight:1,flexShrink:0}}>‹</button>
          <div style={{textAlign:'center',minWidth:32}}>
            <div style={{fontSize:13,fontWeight:700,color:gc_,fontFamily:'Space Mono,monospace',lineHeight:1}}>{bpm}</div>
            <div style={{fontSize:6.25,color:'rgba(255,255,255,0.94)',letterSpacing:'0.1em'}}>BPM</div>
          </div>
          <button onClick={()=>{const v=clamp(bpm+1,40,250);setBpm(v);bpmRef.current=v;}} style={{width:14,height:16,borderRadius:2,border:'none',background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.97)',fontSize:8.5,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Space Mono,monospace',lineHeight:1,flexShrink:0}}>›</button>
          <button onClick={()=>{const v=clamp(bpm+5,40,250);setBpm(v);bpmRef.current=v;}} style={{width:16,height:16,borderRadius:2,border:'none',background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.6)',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Space Mono,monospace',lineHeight:1,flexShrink:0}}>+</button>
          <button onClick={tapTempo} style={{padding:'1px 5px',borderRadius:2,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.97)',fontSize:7.25,cursor:'pointer',fontFamily:'Space Mono,monospace',marginLeft:2}}>TAP</button>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
          <button onClick={()=>setPolySynth(v=>!v)} style={{padding:'4px 7px',borderRadius:3,border:`1px solid ${polySynth?gc_:'rgba(255,255,255,0.1)'}`,background:polySynth?`${gc_}18`:'rgba(255,255,255,0.03)',color:polySynth?gc_:'rgba(255,255,255,0.96)',fontSize:7.75,fontWeight:700,cursor:'pointer',fontFamily:'Space Mono,monospace'}}>SYNTH POLY</button>
          <button onClick={()=>setBassStack(v=>!v)} style={{padding:'4px 7px',borderRadius:3,border:`1px solid ${bassStack?'#22d3ee':'rgba(255,255,255,0.1)'}`,background:bassStack?'rgba(34,211,238,0.12)':'rgba(255,255,255,0.03)',color:bassStack?'#22d3ee':'rgba(255,255,255,0.96)',fontSize:7.75,fontWeight:700,cursor:'pointer',fontFamily:'Space Mono,monospace'}}>BASS STACK</button>
          <button onClick={clearPattern} style={{padding:'4px 8px',borderRadius:3,border:'1px solid rgba(255,80,80,0.35)',background:'rgba(255,80,80,0.08)',color:'#ff8a8a',fontSize:7.75,fontWeight:700,cursor:'pointer',fontFamily:'Space Mono,monospace'}}>CLEAR</button>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap',minWidth:isPhone?'100%':'auto'}}>
          <PresetSelect label='BASS' value={bassPreset} options={SOUND_PRESETS.bass} onChange={applyBassPreset} accent='#22d3ee' />
          <PresetSelect label='SYNTH' value={synthPreset} options={SOUND_PRESETS.synth} onChange={applySynthPreset} accent={gc_} />
          <PresetSelect label='DRUM' value={drumPreset} options={SOUND_PRESETS.drum} onChange={applyDrumPreset} accent='#ffb347' />
          <PresetSelect label='PERF' value={performancePreset} options={SOUND_PRESETS.performance} onChange={applyPerformancePreset} accent='#7ee787' />
        </div>

        {/* Transport */}
        <button onClick={togglePlay} style={{
          padding:'4px 14px',borderRadius:3,border:'none',
          background:isPlaying?'#ff2244':'#00cc66',
          color:'#000',fontSize:9,fontWeight:700,cursor:'pointer',
          letterSpacing:'0.1em',fontFamily:'Space Mono,monospace',
          boxShadow:isPlaying?'0 0 12px #ff224466':'0 0 12px #00cc6666',
          transition:'all 0.1s',flexShrink:0,
        }}>{isPlaying?'■ STOP':'▶ PLAY'}</button>

        {/* Autopilot */}
        <button onClick={()=>setAutopilot(v=>!v)} style={{
          padding:'4px 8px',borderRadius:3,border:`1px solid ${autopilot?gc_:'rgba(255,255,255,0.1)'}`,
          background:autopilot?`${gc_}22`:'rgba(255,255,255,0.04)',
          color:autopilot?gc_:'rgba(255,255,255,0.38)',
          fontSize:7.75,fontWeight:700,cursor:'pointer',letterSpacing:'0.1em',fontFamily:'Space Mono,monospace',
          boxShadow:autopilot?`0 0 10px ${gc_}55`:'none',
          transition:'all 0.12s',flexShrink:0,
        }}>{autopilot?'◈ AUTO':'○ AUTO'}</button>

        {/* View toggle */}
        <div style={{display:'flex',gap:2,flexShrink:0}}>
          {['perform','studio','song'].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{
              padding:'2px 6px',borderRadius:2,border:`1px solid ${view===v?gc_:'rgba(255,255,255,0.08)'}`,
              background:view===v?`${gc_}18`:'transparent',
              color:view===v?gc_:'rgba(255,255,255,0.94)',
              fontSize:7.75,fontWeight:700,cursor:'pointer',letterSpacing:'0.08em',fontFamily:'Space Mono,monospace',
              textTransform:'uppercase',
            }}>{v}</button>
          ))}
        </div>

        {/* Status */}
        <div style={{fontSize:7.75,color:'rgba(255,255,255,0.95)',maxWidth:isPhone?'100%':100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',letterSpacing:'0.05em',flex:isPhone?'1 1 100%':'0 1 auto'}}>
          {recState==='recording'&&<span style={{color:'#ff2244',marginRight:3}}>●</span>}{status}
        </div>
        <div style={{width:5,height:5,borderRadius:'50%',background:midiOk?'#00ff88':'rgba(255,255,255,0.12)',flexShrink:0}}/>
      </div>

      {/* ── CONTEXT BAR — always-visible musical state ── */}
      <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:8,padding:isPhone?'6px 10px':'3px 10px',background:'rgba(0,0,0,0.25)',borderBottom:'1px solid rgba(255,255,255,0.04)',flexShrink:0,minHeight:isPhone?40:20,overflow:'hidden'}}>
        <span style={{fontSize:7.25,color:'rgba(255,255,255,0.92)',letterSpacing:'0.12em',textTransform:'uppercase'}}>NOW PLAYING:</span>
        <span style={{fontSize:7.75,fontWeight:700,color:gc_,letterSpacing:'0.1em',textTransform:'uppercase'}}>{genre}</span>
        <span style={{color:'rgba(255,255,255,0.15)',fontSize:6.75}}>·</span>
        <span style={{fontSize:7.75,color:'rgba(255,255,255,0.97)',letterSpacing:'0.06em'}}>{currentSectionName}</span>
        <span style={{color:'rgba(255,255,255,0.15)',fontSize:6.75}}>·</span>
        <span style={{fontSize:7.75,color:'rgba(255,255,255,0.95)',letterSpacing:'0.06em'}}>{modeName}</span>
        <span style={{color:'rgba(255,255,255,0.15)',fontSize:6.75}}>·</span>
        <span style={{fontSize:7.75,color:'rgba(255,255,255,0.95)',letterSpacing:'0.06em'}}>arp:{arpMode}</span>
        <span style={{color:'rgba(255,255,255,0.15)',fontSize:6.75}}>·</span>
        <span style={{fontSize:7.75,color:'rgba(255,255,255,0.95)',letterSpacing:'0.06em'}}>poly:{polySynth?'3v':'mono'} / bass:{bassStack?'stack':'mono'}</span>
        <span style={{color:'rgba(255,255,255,0.15)',fontSize:6.75}}>·</span>
        <span style={{fontSize:7.75,color:isPlaying?'#00ff88':'rgba(255,255,255,0.92)',letterSpacing:'0.06em'}}>{isPlaying?'▶ RUNNING':'■ STOPPED'}</span>
        {autopilot&&<><span style={{color:'rgba(255,255,255,0.15)',fontSize:6.75}}>·</span><span style={{fontSize:7.75,color:gc_,letterSpacing:'0.06em'}}>◈ AUTOPILOT ON</span></>}
        {songActive&&<><span style={{color:'rgba(255,255,255,0.15)',fontSize:6.75}}>·</span><span style={{fontSize:7.75,color:'#ffaa00',letterSpacing:'0.06em'}}>ARC {arcIdx+1}/{songArc.length}</span></>}
        <div style={{flex:1}}/>
        {['drums','bass','synth'].map(key=>(<div key={key} style={{display:'flex',gap:2,alignItems:'center'}}>{PATTERN_AUTHORITY_LEVELS.map(level=>(<button key={level} onClick={()=>setPatternAuthority(prev=>{const next={...prev,[key]:level};patternAuthorityRef.current=next;return next;})} style={{padding:'1px 4px',borderRadius:2,border:`1px solid ${patternAuthority[key]===level?(key==='drums'?'#ffb347':key==='bass'?'#22d3ee':gc_):'rgba(255,255,255,0.08)'}`,background:patternAuthority[key]===level?`${key==='drums'?'#ffb347':key==='bass'?'#22d3ee':gc_}18`:'transparent',color:patternAuthority[key]===level?(key==='drums'?'#ffb347':key==='bass'?'#22d3ee':gc_):'rgba(255,255,255,0.82)',fontSize:6.25,fontFamily:'Space Mono,monospace',textTransform:'uppercase',cursor:'pointer'}}>{key[0]}:{level[0]}</button>))}</div>))}
        {!isPhone&&<span style={{fontSize:6.75,color:'rgba(255,255,255,0.88)',letterSpacing:'0.08em'}}>SPACE=play · A=drop · S=break · D=build · F=groove · G=tension · M=mutate · R=regen · P=auto · T=tap</span>}
      </div>

      {/* ── VIEWS ── */}
      {view==='perform'&&<PerformView
        genre={genre} gc={gc_} isPlaying={isPlaying}
        currentSectionName={currentSectionName} laneVU={laneVU}
        patterns={patterns} bassLine={bassLine} synthLine={synthLine}
        laneLen={laneLen} step={step} page={page} setPage={setPage}
        activeNotes={activeNotes} arpeMode={arpMode} modeName={modeName}
        autopilot={autopilot} autopilotIntensity={autopilotIntensity}
        setAutopilotIntensity={setAutopilotIntensity}
        perfActions={perfActions} regenerateSection={regenerateSection}
        setNote={setNote}
        savedScenes={savedScenes} saveScene={saveScene} loadScene={loadScene}
        master={master} setMaster={setMaster}
        space={space} setSpace={setSpace}
        tone={tone} setTone={setTone}
        drive={drive} setDrive={setDrive}
        grooveAmt={grooveAmt} setGrooveAmt={setGrooveAmt}
        swing={swing} setSwing={setSwing}
        toggleCell={toggleCell}
        songArc={songArc} arcIdx={arcIdx} songActive={songActive}
        bassPreset={bassPreset} synthPreset={synthPreset} drumPreset={drumPreset} performancePreset={performancePreset}
        applyBassPreset={applyBassPreset} applySynthPreset={applySynthPreset} applyDrumPreset={applyDrumPreset} applyPerformancePreset={applyPerformancePreset}
        laneVolume={laneVolume} setLaneVolume={setLaneVolume}
        laneProbability={laneProbability} setLaneProbability={setLaneProbability}
        synthChordChance={synthChordChance} setSynthChordChance={setSynthChordChance}
        synthHold={synthHold} setSynthHold={setSynthHold}
        synthCurve={synthCurve} setSynthCurve={setSynthCurve}
        compact={isCompact} phone={isPhone}
      />}

      {view==='studio'&&<StudioView
        genre={genre} gc={gc_} patterns={patterns} bassLine={bassLine} synthLine={synthLine}
        laneLen={laneLen} step={step} page={page} setPage={setPage}
        toggleCell={toggleCell} setNote={setNote}
        modeName={modeName} laneVU={laneVU}
        space={space} setSpace={setSpace}
        tone={tone} setTone={setTone}
        noiseMix={noiseMix} setNoiseMix={setNoiseMix}
        drive={drive} setDrive={setDrive}
        compress={compress} setCompress={setCompress}
        bassFilter={bassFilter} setBassFilter={setBassFilter}
        synthFilter={synthFilter} setSynthFilter={setSynthFilter}
        drumDecay={drumDecay} setDrumDecay={setDrumDecay}
        bassSubAmt={bassSubAmt} setBassSubAmt={setBassSubAmt}
        fmIdx={fmIdx} setFmIdx={setFmIdx}
        master={master} setMaster={setMaster}
        swing={swing} setSwing={setSwing}
        humanize={humanize} setHumanize={setHumanize}
        grooveAmt={grooveAmt} setGrooveAmt={setGrooveAmt}
        grooveProfile={grooveProfile} setGrooveProfile={v=>{setGrooveProfile(v);grooveProfileRef.current=v;}}
        regenerateSection={regenerateSection}
        currentSectionName={currentSectionName}
        undoLen={undoLen} undo={undo}
        recState={recState} startRec={startRec} stopRec={stopRec}
        recordings={recordings}
        exportJSON={exportJSON} importRef={importRef} importJSON={importJSON}
        savedScenes={savedScenes} saveScene={saveScene} loadScene={loadScene}
        projectName={projectName} setProjectName={setProjectName}
        clearPattern={clearPattern} polySynth={polySynth} setPolySynth={setPolySynth} bassStack={bassStack} setBassStack={setBassStack}
        bassPreset={bassPreset} synthPreset={synthPreset} drumPreset={drumPreset} performancePreset={performancePreset}
        applyBassPreset={applyBassPreset} applySynthPreset={applySynthPreset} applyDrumPreset={applyDrumPreset} applyPerformancePreset={applyPerformancePreset}
        laneVolume={laneVolume} setLaneVolume={setLaneVolume}
        laneProbability={laneProbability} setLaneProbability={setLaneProbability}
        synthChordChance={synthChordChance} setSynthChordChance={setSynthChordChance}
        synthHold={synthHold} setSynthHold={setSynthHold}
        synthCurve={synthCurve} setSynthCurve={setSynthCurve}
        compact={isCompact} phone={isPhone}
      />}

      {view==='song'&&<SongView
        genre={genre} gc={gc_}
        songArc={songArc} arcIdx={arcIdx} songActive={songActive}
        startSongArc={startSongArc} stopSongArc={stopSongArc}
        currentSectionName={currentSectionName}
        SONG_ARCS={SONG_ARCS} SECTIONS={SECTIONS}
        triggerSection={triggerSection}
        modeName={modeName} arpeMode={arpMode}
        bpm={bpm}
        compact={isCompact} phone={isPhone}
      />}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PERFORM VIEW — full-screen live performance interface
// ─────────────────────────────────────────────────────────────────────────────
function PerformView({genre,gc,isPlaying,currentSectionName,laneVU,patterns,bassLine,synthLine,laneLen,step,page,setPage,activeNotes,arpeMode,modeName,autopilot,autopilotIntensity,setAutopilotIntensity,perfActions,regenerateSection,savedScenes,saveScene,loadScene,master,setMaster,space,setSpace,tone,setTone,drive,setDrive,grooveAmt,setGrooveAmt,swing,setSwing,toggleCell,songArc,arcIdx,songActive,setNote,bassPreset,synthPreset,drumPreset,performancePreset,applyBassPreset,applySynthPreset,applyDrumPreset,applyPerformancePreset,laneVolume,setLaneVolume,laneProbability,setLaneProbability,synthChordChance,setSynthChordChance,synthHold,setSynthHold,synthCurve,setSynthCurve,compact,phone}){
  const SECTION_COLORS={drop:'#ff2244',break:'#4488ff',build:'#ffaa00',groove:'#00cc66',tension:'#ff6622',fill:'#cc00ff',intro:'#44ffcc',outro:'#aaaaaa'};
  const sc=SECTION_COLORS[currentSectionName]||gc;
  const visibleStart=page*16,visibleEnd=Math.min(visibleStart+16,MAX_STEPS);
  const visIdx=Array.from({length:visibleEnd-visibleStart},(_,i)=>visibleStart+i);
  const SECTS=['drop','break','build','groove','tension','fill','intro','outro'];
  const shortcut={drop:'A',break:'S',build:'D',groove:'F',tension:'G',fill:'H'};

  return(
    <div style={{flex:1,display:'flex',flexDirection:compact?'column':'row',gap:6,padding:phone?'8px':'5px 7px 8px 7px',minHeight:0,overflowY:'auto',overflowX:'hidden'}}>

      {/* LEFT — Section triggers + autopilot */}
      <div style={{width:compact?'100%':118,display:'flex',flexDirection:'column',gap:3,flexShrink:0}}>
        {/* Section pads */}
        <div style={{fontSize:6.75,color:'rgba(255,255,255,0.9)',letterSpacing:'0.18em',marginBottom:1,textTransform:'uppercase'}}>SECTIONS</div>
        {SECTS.map(sec=>{
          const scl=SECTION_COLORS[sec]||'#ffffff';
          const isActive=currentSectionName===sec;
          return(
            <button key={sec} onClick={()=>perfActions[sec]?perfActions[sec]():null} style={{
              padding:'6px 6px',borderRadius:4,border:`1px solid ${isActive?scl:scl+'33'}`,
              background:isActive?`${scl}22`:`${scl}08`,
              color:isActive?scl:`${scl}88`,
              fontSize:8.5,fontWeight:700,cursor:'pointer',
              fontFamily:'Space Mono,monospace',letterSpacing:'0.1em',
              textTransform:'uppercase',transition:'all 0.08s',
              boxShadow:isActive?`0 0 8px ${scl}44`:'none',
              display:'flex',justifyContent:'space-between',alignItems:'center',
            }}>
              <span>{sec}</span>
              {shortcut[sec]&&<span style={{fontSize:6.75,opacity:0.4}}>[{shortcut[sec]}]</span>}
            </button>
          );
        })}

        {/* Actions */}
        <div style={{fontSize:6.75,color:'rgba(255,255,255,0.88)',letterSpacing:'0.18em',marginTop:3,textTransform:'uppercase'}}>ACTIONS</div>
        {[
          {label:'MUTATE',fn:perfActions.mutate,key:'M',tip:'flip drum hits'},
          {label:'THIN',fn:perfActions.thinOut,tip:'sparse out'},
          {label:'THICKEN',fn:perfActions.thicken,tip:'add hits'},
          {label:'REHARM',fn:perfActions.reharmonize,tip:'new chords'},
          {label:'ARP→',fn:perfActions.shiftArp,tip:'change pattern'},
          {label:'REGEN',fn:()=>regenerateSection(currentSectionName),key:'R',tip:'full rebuild'},
          {label:'RND SYNTH',fn:perfActions.randomizeNotes,tip:'random notes'},
          {label:'RND BASS',fn:perfActions.randomizeBass,tip:'random bass'},
          {label:'NOTES ↑',fn:perfActions.shiftNotesUp,tip:'shift up'},
          {label:'NOTES ↓',fn:perfActions.shiftNotesDown,tip:'shift down'},
          {label:'CLEAR',fn:perfActions.clear,tip:'clear all lanes'},
        ].map(({label,fn,key,tip})=>(
          <button key={label} onClick={fn} title={tip} style={{
            padding:'4px 6px',borderRadius:3,border:'1px solid rgba(255,255,255,0.08)',
            background:'rgba(255,255,255,0.02)',color:'rgba(255,255,255,0.48)',
            fontSize:7.75,fontWeight:700,cursor:'pointer',fontFamily:'Space Mono,monospace',
            letterSpacing:'0.06em',display:'flex',justifyContent:'space-between',alignItems:'center',
          }}>
            <span>{label}</span>
            {key&&<span style={{fontSize:6.75,opacity:0.35}}>[{key}]</span>}
          </button>
        ))}
      </div>

      {/* CENTER — Grid + VU */}
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:4,minWidth:0,order:compact?1:2}}>

        {/* Section indicator + info bar */}
        <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:8,minHeight:22,flexShrink:0}}>
          <div style={{fontSize:13,fontWeight:700,color:sc,letterSpacing:'0.16em',textTransform:'uppercase',textShadow:`0 0 16px ${sc}55`}}>
            {currentSectionName.toUpperCase()}
          </div>
          <div style={{width:1,height:12,background:'rgba(255,255,255,0.08)'}}/>
          <span style={{fontSize:7.75,color:'rgba(255,255,255,0.95)',letterSpacing:'0.08em'}}>{genre} · {modeName} · arp:{arpeMode}</span>
          <div style={{flex:1}}/>
          {songArc.length>0&&(
            <div style={{display:'flex',gap:2,alignItems:'center'}}>
              {songArc.map((s,i)=>(
                <div key={i} style={{width:i===arcIdx?22:14,height:4,borderRadius:2,background:i===arcIdx?SECTION_COLORS[s]||gc:i<arcIdx?'rgba(255,255,255,0.88)':'rgba(255,255,255,0.05)',transition:'all 0.2s'}}/>
              ))}
            </div>
          )}
          <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{...navBtn,opacity:page===0?0.3:1,padding:'1px 5px',fontSize:9}}>‹</button>
          <span style={{fontSize:7.75,color:'rgba(255,255,255,0.93)',fontFamily:'Space Mono,monospace'}}>{page+1}/4</span>
          <button onClick={()=>setPage(p=>Math.min(3,p+1))} disabled={page===3} style={{...navBtn,opacity:page===3?0.3:1,padding:'1px 5px',fontSize:9}}>›</button>
        </div>

        {/* Lane rows with VU + grid */}
        {['kick','snare','hat','bass','synth'].map(lane=>{
          const lc=LANE_CLR[lane];
          const ll=laneLen[lane]||16;
          const vu=laneVU[lane]||0;
          return(
            <div key={lane} style={{flex:1,display:'flex',alignItems:'stretch',gap:5,minHeight:0}}>
              {/* Lane label + VU */}
              <div style={{width:38,flexShrink:0,display:'flex',flexDirection:'column',justifyContent:'center',gap:1}}>
                <span style={{fontSize:6.75,fontWeight:700,color:lc,letterSpacing:'0.14em',textTransform:'uppercase'}}>{lane}</span>
                <div style={{height:3,borderRadius:2,background:'rgba(255,255,255,0.05)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${vu*100}%`,background:lc,borderRadius:2,transition:'width 0.04s',boxShadow:`0 0 4px ${lc}`}}/>
                </div>
                {(lane==='bass'||lane==='synth')&&(
                  <span style={{fontSize:6.25,color:'rgba(255,255,255,0.92)',letterSpacing:'0.04em'}}>{activeNotes[lane]}</span>
                )}
              </div>
              {/* Step grid */}
              <div style={{flex:1,display:'grid',gridTemplateColumns:`repeat(${visIdx.length},1fr)`,gap:1.5,alignItems:'stretch'}}>
                {visIdx.map(idx=>{
                  if(idx>=ll)return<div key={idx} style={{borderRadius:2,background:'rgba(255,255,255,0.015)',opacity:0.25}}/>;
                  const sd=patterns[lane][idx];
                  const on=sd.on,isActive=step===idx&&isPlaying;
                  const isTied=sd.tied;
                  const isBeat=idx%4===0,isBar=idx%16===0;
                  return(
                    <button key={idx} onClick={()=>toggleCell(lane,idx)} style={{
                      borderRadius:isTied?'1px 2px 2px 1px':'2px',
                      borderTop:`1px solid ${isActive?lc:isBar?`${lc}44`:isBeat?'rgba(255,255,255,0.07)':'rgba(255,255,255,0.03)'}`,
                      borderRight:`1px solid ${isActive?lc:isBar?`${lc}44`:isBeat?'rgba(255,255,255,0.07)':'rgba(255,255,255,0.03)'}`,
                      borderBottom:`1px solid ${isActive?lc:isBar?`${lc}44`:isBeat?'rgba(255,255,255,0.07)':'rgba(255,255,255,0.03)'}`,
                      borderLeft:isTied?`2px solid ${lc}44`:`1px solid ${isActive?lc:isBar?`${lc}44`:isBeat?'rgba(255,255,255,0.07)':'rgba(255,255,255,0.03)'}`,
                      background:isActive?`${lc}88`:isTied?`${lc}1a`:on?`${lc}${Math.round(clamp((sd.p||1),0.3,1)*255).toString(16).padStart(2,'0')}`:'rgba(255,255,255,0.02)',
                      boxShadow:isActive?`0 0 7px ${lc}77`:on&&!isTied?`0 0 2px ${lc}22`:'none',
                      cursor:'pointer',transition:'background 0.03s',
                    }}/>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Note info row */}
        <div style={{display:'flex',gap:1.5,flexShrink:0,height:12}}>
          {visIdx.map(idx=>{
            const bn=bassLine[idx],sn=synthLine[idx];
            const hasBass=patterns.bass[idx]?.on;
            const hasSynth=patterns.synth[idx]?.on;
            return(
              <div key={idx} style={{flex:1,textAlign:'center'}}>
                {(hasBass||hasSynth)&&<span style={{fontSize:5,color:'rgba(255,255,255,0.9)',fontFamily:'Space Mono,monospace'}}>{hasBass?bn.replace(/[0-9]/g,''):sn.replace(/[0-9]/g,'')}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT — Macro knobs + scenes */}
      <div style={{width:compact?'100%':118,display:'flex',flexDirection:'column',gap:4,flexShrink:0,order:compact?3:3}}>
        {/* Main macro faders */}
        <div style={{fontSize:6.75,color:'rgba(255,255,255,0.9)',letterSpacing:'0.18em',textTransform:'uppercase',marginBottom:1}}>MACROS</div>
        {[
          {label:'MASTER',v:master,s:setMaster,c:'#ffffff'},
          {label:'SPACE',v:space,s:setSpace,c:'#44ffcc'},
          {label:'TONE',v:tone,s:setTone,c:'#22d3ee'},
          {label:'DRIVE',v:drive,s:setDrive,c:'#ff8844'},
          {label:'GROOVE',v:grooveAmt,s:setGrooveAmt,c:'#ffdd00'},
          {label:'SWING',v:swing,s:setSwing,min:0,max:0.25,c:'#aa88ff'},
          {label:'AUTO INT',v:autopilotIntensity,s:setAutopilotIntensity,c:gc},
        ].map(({label,v,s,c,min=0,max=1})=>(
          <div key={label} style={{display:'flex',flexDirection:'column',gap:1}}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span style={{fontSize:6.75,letterSpacing:'0.08em',color:'rgba(255,255,255,0.94)',textTransform:'uppercase'}}>{label}</span>
              <span style={{fontSize:6.75,color:c,fontFamily:'Space Mono,monospace'}}>{((v-min)/(max-min)*100).toFixed(0)}</span>
            </div>
            <input type="range" min={min} max={max} step={0.01} value={v} onChange={e=>s(Number(e.target.value))} style={{width:'100%',color:c,accentColor:c,height:12}}/>
          </div>
        ))}

        <div style={{fontSize:6.75,color:'rgba(255,255,255,0.9)',letterSpacing:'0.18em',textTransform:'uppercase',marginTop:1}}>LANES</div>
        {[
          {label:'DRUM VOL',value:laneVolume.kick,min:0,max:1.2,color:'#ffb347',onChange:v=>setLaneVolume(p=>({...p,kick:v,snare:Math.min(1.2,v*0.96),hat:Math.min(1.2,v*0.82)}))},
          {label:'BASS VOL',value:laneVolume.bass,min:0,max:1.2,color:'#22d3ee',onChange:v=>setLaneVolume(p=>({...p,bass:v}))},
          {label:'SYN VOL',value:laneVolume.synth,min:0,max:1.2,color:gc,onChange:v=>setLaneVolume(p=>({...p,synth:v}))},
          {label:'SYN PROB',value:laneProbability.synth,min:0,max:1,color:gc,onChange:v=>setLaneProbability(p=>({...p,synth:v}))},
          {label:'CHORD',value:synthChordChance,min:0,max:1,color:'#c084fc',onChange:v=>setSynthChordChance(v)},
          {label:'HOLD',value:synthHold,min:0,max:1,color:'#7dd3fc',onChange:v=>setSynthHold(v)},
        ].map(({label,value,min,max,color,onChange})=>(
          <div key={label} style={{display:'flex',flexDirection:'column',gap:1}}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span style={{fontSize:6.4,letterSpacing:'0.08em',color:'rgba(255,255,255,0.94)',textTransform:'uppercase'}}>{label}</span>
              <span style={{fontSize:6.4,color, fontFamily:'Space Mono,monospace'}}>{(((value-min)/(max-min||1))*100).toFixed(0)}</span>
            </div>
            <input type="range" min={min} max={max} step={0.01} value={value} onChange={e=>onChange(Number(e.target.value))} style={{width:'100%',accentColor:color,height:12}}/>
          </div>
        ))}
        <label style={{display:'flex',flexDirection:'column',gap:1}}>
          <span style={{fontSize:6.4,letterSpacing:'0.08em',color:'rgba(255,255,255,0.94)',textTransform:'uppercase'}}>SYN CURVE</span>
          <select value={synthCurve} onChange={e=>setSynthCurve(e.target.value)} style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${gc}33`,color:gc,borderRadius:3,padding:'3px 5px',fontSize:7.1,fontFamily:'Space Mono,monospace'}}>
            {SYNTH_CURVES.map(cur=><option key={cur} value={cur} style={{color:'#111',background:'#f2f2f2'}}>{cur}</option>)}
          </select>
        </label>

        <div style={{flex:1}}/>

        {/* Scenes */}
        <div style={{fontSize:6.75,color:'rgba(255,255,255,0.9)',letterSpacing:'0.18em',textTransform:'uppercase',marginBottom:1}}>SCENES</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:2}}>
          {savedScenes.map((sc,i)=>(
            <div key={i} style={{display:'flex',flexDirection:'column',gap:1}}>
              <button onClick={()=>loadScene(i)} style={{
                padding:'4px 2px',borderRadius:2,border:`1px solid ${sc?gc+'44':'rgba(255,255,255,0.07)'}`,
                background:sc?`${gc}0e`:'rgba(255,255,255,0.015)',
                color:sc?gc:'rgba(255,255,255,0.9)',
                fontSize:7.75,fontWeight:700,cursor:'pointer',fontFamily:'Space Mono,monospace',
                textAlign:'center',
              }}>
                S{i+1}{sc?'◆':''}
              </button>
              <button onClick={()=>saveScene(i)} style={{padding:'1px',borderRadius:2,border:'1px solid rgba(255,255,255,0.05)',background:'rgba(255,255,255,0.015)',color:'rgba(255,255,255,0.9)',fontSize:6.25,cursor:'pointer',fontFamily:'Space Mono,monospace',textAlign:'center'}}>SAVE</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const navBtn={padding:'1px 5px',borderRadius:2,border:'1px solid rgba(255,255,255,0.09)',background:'rgba(255,255,255,0.03)',color:'rgba(255,255,255,0.97)',fontSize:9,cursor:'pointer',fontFamily:'Space Mono,monospace'};

function PresetSelect({label,value,options,onChange,accent='#ffffff',compact=false}){
  return(
    <label style={{display:'flex',flexDirection:'column',gap:2,minWidth:compact?112:124}}>
      <span style={{fontSize:6.75,color:'rgba(255,255,255,0.93)',letterSpacing:'0.12em',textTransform:'uppercase'}}>{label}</span>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${accent}33`,color:accent,borderRadius:4,padding:compact?'4px 6px':'5px 7px',fontSize:7.75,fontFamily:'Space Mono,monospace',outline:'none'}}>
        {Object.entries(options).map(([key,preset])=><option key={key} value={key} style={{color:'#111',background:'#f2f2f2'}}>{preset.label}</option>)}
      </select>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDIO VIEW — detailed editor
// ─────────────────────────────────────────────────────────────────────────────
function StudioView({genre,gc,patterns,bassLine,synthLine,laneLen,step,page,setPage,toggleCell,setNote,modeName,laneVU,space,setSpace,tone,setTone,noiseMix,setNoiseMix,drive,setDrive,compress,setCompress,bassFilter,setBassFilter,synthFilter,setSynthFilter,drumDecay,setDrumDecay,bassSubAmt,setBassSubAmt,fmIdx,setFmIdx,master,setMaster,swing,setSwing,humanize,setHumanize,grooveAmt,setGrooveAmt,grooveProfile,setGrooveProfile,regenerateSection,currentSectionName,undoLen,undo,recState,startRec,stopRec,recordings,exportJSON,importRef,importJSON,savedScenes,saveScene,loadScene,projectName,setProjectName,clearPattern,polySynth,setPolySynth,bassStack,setBassStack,bassPreset,synthPreset,drumPreset,performancePreset,applyBassPreset,applySynthPreset,applyDrumPreset,applyPerformancePreset,laneVolume,setLaneVolume,laneProbability,setLaneProbability,synthChordChance,setSynthChordChance,synthHold,setSynthHold,synthCurve,setSynthCurve,compact,phone}){
  const [tab,setTab]=useState('mixer');
  const [noteEditLane,setNoteEditLane]=useState('bass');
  const visibleStart=page*16,visibleEnd=Math.min(visibleStart+16,MAX_STEPS);
  const visIdx=Array.from({length:visibleEnd-visibleStart},(_,i)=>visibleStart+i);
  const mode=MODES[modeName]||MODES.minor;
  const notePool=noteEditLane==='bass'?mode.b:mode.s;

  return(
    <div style={{flex:1,display:'flex',flexDirection:compact?'column':'row',gap:5,padding:phone?'8px':'5px 7px 8px 7px',minHeight:0,overflowY:'auto',overflowX:'hidden'}}>

      {/* LEFT — Grid editor */}
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:3,minWidth:0}}>
        {/* Grid header */}
        <div style={{display:'flex',alignItems:'center',gap:5,height:20,flexShrink:0}}>
          <span style={{fontSize:7.75,color:'rgba(255,255,255,0.95)',letterSpacing:'0.1em'}}>{genre.toUpperCase()} · {modeName.toUpperCase()} · {currentSectionName.toUpperCase()}</span>
          <div style={{flex:1}}/>
          <button onClick={undo} disabled={undoLen===0} style={{...navBtn,opacity:undoLen>0?1:0.3,fontSize:7.75}}>↩ ({undoLen})</button>
          <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{...navBtn,opacity:page===0?0.3:1}}>‹</button>
          <span style={{fontSize:7.75,color:'rgba(255,255,255,0.92)',fontFamily:'Space Mono,monospace'}}>pg {page+1}/4</span>
          <button onClick={()=>setPage(p=>Math.min(3,p+1))} disabled={page===3} style={{...navBtn,opacity:page===3?0.3:1}}>›</button>
        </div>

        {/* Lane grids */}
        {['kick','snare','hat','bass','synth'].map(lane=>{
          const lc=LANE_CLR[lane];const ll=laneLen[lane]||16;const vu=laneVU[lane]||0;
          return(
            <div key={lane} style={{flex:1,display:'flex',alignItems:'stretch',gap:4,minHeight:0}}>
              <div style={{width:36,flexShrink:0,display:'flex',flexDirection:'column',justifyContent:'center',gap:1}}>
                <span style={{fontSize:6.75,fontWeight:700,color:lc,letterSpacing:'0.12em',textTransform:'uppercase'}}>{lane}</span>
                <div style={{height:2,borderRadius:1,background:'rgba(255,255,255,0.05)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${vu*100}%`,background:lc,borderRadius:1,transition:'width 0.04s'}}/>
                </div>
              </div>
              <div style={{flex:1,display:'grid',gridTemplateColumns:`repeat(${visIdx.length},1fr)`,gap:1.5,alignItems:'stretch'}}>
                {visIdx.map(idx=>{
                  if(idx>=ll)return<div key={idx} style={{borderRadius:2,background:'rgba(255,255,255,0.015)',opacity:0.4}}/>;
                  const sd=patterns[lane][idx];const on=sd.on,isActive=step===idx;
                  const isBeat=idx%4===0,isBar=idx%16===0;
                  return(
                    <button key={idx} onClick={()=>toggleCell(lane,idx)} style={{
                      borderRadius:2,border:`1px solid ${isActive?lc:isBar?`${lc}38`:isBeat?'rgba(255,255,255,0.07)':'rgba(255,255,255,0.03)'}`,
                      background:isActive?`${lc}77`:on?`${lc}66`:'rgba(255,255,255,0.02)',
                      cursor:'pointer',transition:'background 0.03s',
                    }}/>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Note editor row */}
        <div style={{flexShrink:0,borderTop:'1px solid rgba(255,255,255,0.05)',paddingTop:4}}>
          <div style={{display:'flex',gap:4,marginBottom:3,alignItems:'center'}}>
            <span style={{fontSize:7.75,color:'rgba(255,255,255,0.94)',letterSpacing:'0.12em'}}>NOTES</span>
            {['bass','synth'].map(l=>(
              <button key={l} onClick={()=>setNoteEditLane(l)} style={{...navBtn,border:`1px solid ${noteEditLane===l?LANE_CLR[l]:'rgba(255,255,255,0.1)'}`,color:noteEditLane===l?LANE_CLR[l]:'rgba(255,255,255,0.95)',fontSize:7.75}}>{l}</button>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:`repeat(${visIdx.length},1fr)`,gap:1.5}}>
            {visIdx.map(idx=>{
              const lc=LANE_CLR[noteEditLane];
              const isOn=noteEditLane==='bass'?patterns.bass[idx]?.on:patterns.synth[idx]?.on;
              const curNote=noteEditLane==='bass'?bassLine[idx]:synthLine[idx];
              const cur=notePool.indexOf(curNote);
              return(
                <div key={idx} style={{opacity:isOn?1:0.2}}>
                  <button disabled={!isOn} onClick={()=>{if(!isOn)return;const next=notePool[(cur+1)%notePool.length];setNote(noteEditLane,idx,next);}}
                    style={{width:'100%',padding:'2px 0',borderRadius:2,border:`1px solid ${isOn?lc+'44':'rgba(255,255,255,0.04)'}`,background:isOn?`${lc}1a`:'rgba(255,255,255,0.01)',color:isOn?lc:'rgba(255,255,255,0.9)',fontSize:6.75,cursor:isOn?'pointer':'default',fontFamily:'Space Mono,monospace',textAlign:'center'}}>
                    {curNote||'—'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT — Controls */}
      <div style={{width:compact?'100%':178,display:'flex',flexDirection:'column',gap:0,flexShrink:0,borderLeft:compact?'none':'1px solid rgba(255,255,255,0.05)',borderTop:compact?'1px solid rgba(255,255,255,0.05)':'none'}}>
        {/* Tabs */}
        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:4,alignItems:'flex-end'}}>
          <PresetSelect label='BASS' value={bassPreset} options={SOUND_PRESETS.bass} onChange={applyBassPreset} accent='#22d3ee' compact />
          <PresetSelect label='SYNTH' value={synthPreset} options={SOUND_PRESETS.synth} onChange={applySynthPreset} accent={gc} compact />
          <PresetSelect label='DRUM' value={drumPreset} options={SOUND_PRESETS.drum} onChange={applyDrumPreset} accent='#ffb347' compact />
          <PresetSelect label='PERF' value={performancePreset} options={SOUND_PRESETS.performance} onChange={applyPerformancePreset} accent='#7ee787' compact />
          <button onClick={clearPattern} style={{padding:'4px 8px',borderRadius:3,border:'1px solid rgba(255,80,80,0.3)',background:'rgba(255,80,80,0.08)',color:'#ff8a8a',fontSize:7.75,cursor:'pointer',fontFamily:'Space Mono,monospace'}}>CLEAR</button><button onClick={()=>setPolySynth(v=>!v)} style={{padding:'4px 8px',borderRadius:3,border:`1px solid ${polySynth?gc:'rgba(255,255,255,0.08)'}`,background:polySynth?`${gc}18`:'rgba(255,255,255,0.03)',color:polySynth?gc:'rgba(255,255,255,0.95)',fontSize:7.75,cursor:'pointer',fontFamily:'Space Mono,monospace'}}>SYNTH POLY</button><button onClick={()=>setBassStack(v=>!v)} style={{padding:'4px 8px',borderRadius:3,border:'1px solid rgba(34,211,238,0.25)',background:bassStack?'rgba(34,211,238,0.12)':'rgba(255,255,255,0.03)',color:bassStack?'#22d3ee':'rgba(255,255,255,0.95)',fontSize:7.75,cursor:'pointer',fontFamily:'Space Mono,monospace'}}>BASS STACK</button></div><div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.05)',flexShrink:0}}>
          {['mixer','synth','session'].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'5px 0',fontSize:7.25,fontWeight:700,letterSpacing:'0.1em',border:'none',background:'transparent',color:tab===t?gc:'rgba(255,255,255,0.9)',cursor:'pointer',borderBottom:tab===t?`2px solid ${gc}`:'2px solid transparent',textTransform:'uppercase',fontFamily:'Space Mono,monospace',transition:'color 0.1s'}}>{t}</button>
          ))}
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'6px 7px',display:'flex',flexDirection:'column',gap:4}}>

          {tab==='mixer'&&<>
            {[
              {l:'MASTER',v:master,s:setMaster,c:'#ffffff'},
              {l:'SPACE',v:space,s:setSpace,c:'#44ffcc'},
              {l:'TONE',v:tone,s:setTone,c:'#22d3ee'},
              {l:'NOISE',v:noiseMix,s:setNoiseMix,c:'#aaaaaa'},
              {l:'DRIVE',v:drive,s:setDrive,c:'#ff8844'},
              {l:'COMPRESS',v:compress,s:setCompress,c:'#ffaa44'},
              {l:'BASS FILTER',v:bassFilter,s:setBassFilter,c:LANE_CLR.bass},
              {l:'SYNTH FILTER',v:synthFilter,s:setSynthFilter,c:LANE_CLR.synth},
              {l:'DRUM DECAY',v:drumDecay,s:setDrumDecay,c:LANE_CLR.kick},
              {l:'BASS SUB',v:bassSubAmt,s:setBassSubAmt,c:LANE_CLR.bass},
              {l:'SWING',v:swing,s:setSwing,min:0,max:0.25,c:'#aa88ff'},
              {l:'HUMANIZE',v:humanize,s:setHumanize,min:0,max:0.05,c:'#88aaff'},
              {l:'GROOVE AMT',v:grooveAmt,s:setGrooveAmt,c:'#ffdd00'},
              {l:'FM INDEX',v:fmIdx,s:setFmIdx,min:0,max:3,c:'#cc88ff'},
            ].map(({l,v,s,c,min=0,max=1})=>(
              <div key={l}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:0}}>
                  <span style={{fontSize:6.75,letterSpacing:'0.08em',color:'rgba(255,255,255,0.94)',textTransform:'uppercase'}}>{l}</span>
                  <span style={{fontSize:6.75,color:c,fontFamily:'Space Mono,monospace'}}>{((v-min)/(max-min)*100).toFixed(0)}</span>
                </div>
                <input type="range" min={min} max={max} step={(max-min)/200} value={v} onChange={e=>s(Number(e.target.value))} style={{width:'100%',accentColor:c,color:c,height:12}}/>
              </div>
            ))}
            <div>
              <div style={{fontSize:6.75,color:'rgba(255,255,255,0.92)',letterSpacing:'0.1em',marginBottom:2,textTransform:'uppercase'}}>LANE MIX</div>
              {[
                {l:'DRUM VOL',v:laneVolume.kick,s:v=>setLaneVolume(p=>({...p,kick:v,snare:Math.min(1.2,v*0.96),hat:Math.min(1.2,v*0.82)})),min:0,max:1.2,c:'#ffb347'},
                {l:'BASS VOL',v:laneVolume.bass,s:v=>setLaneVolume(p=>({...p,bass:v})),min:0,max:1.2,c:LANE_CLR.bass},
                {l:'SYNTH VOL',v:laneVolume.synth,s:v=>setLaneVolume(p=>({...p,synth:v})),min:0,max:1.2,c:LANE_CLR.synth},
                {l:'DRUM PROB',v:laneProbability.kick,s:v=>setLaneProbability(p=>({...p,kick:v,snare:v,hat:v})),min:0,max:1,c:'#ffb347'},
                {l:'BASS PROB',v:laneProbability.bass,s:v=>setLaneProbability(p=>({...p,bass:v})),min:0,max:1,c:LANE_CLR.bass},
                {l:'SYNTH PROB',v:laneProbability.synth,s:v=>setLaneProbability(p=>({...p,synth:v})),min:0,max:1,c:LANE_CLR.synth},
              ].map(({l,v,s,c,min=0,max=1})=>(
                <div key={l}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:0}}>
                    <span style={{fontSize:6.75,letterSpacing:'0.08em',color:'rgba(255,255,255,0.94)',textTransform:'uppercase'}}>{l}</span>
                    <span style={{fontSize:6.75,color:c,fontFamily:'Space Mono,monospace'}}>{((v-min)/(max-min)*100).toFixed(0)}</span>
                  </div>
                  <input type="range" min={min} max={max} step={0.01} value={v} onChange={e=>s(Number(e.target.value))} style={{width:'100%',accentColor:c,color:c,height:12}}/>
                </div>
              ))}
            </div>
            <div>
              <div style={{fontSize:6.75,color:'rgba(255,255,255,0.92)',letterSpacing:'0.1em',marginBottom:2,textTransform:'uppercase'}}>GROOVE PROFILE</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2}}>
                {['steady','broken','bunker','float'].map(gp=>(
                  <button key={gp} onClick={()=>setGrooveProfile(gp)} style={{
                    padding:'3px',borderRadius:2,border:`1px solid ${grooveProfile===gp?gc:'rgba(255,255,255,0.08)'}`,
                    background:grooveProfile===gp?`${gc}18`:'rgba(255,255,255,0.02)',
                    color:grooveProfile===gp?gc:'rgba(255,255,255,0.94)',
                    fontSize:7.25,cursor:'pointer',fontFamily:'Space Mono,monospace',letterSpacing:'0.06em',textTransform:'uppercase',
                  }}>{gp}</button>
                ))}
              </div>
            </div>
          </>}

          {tab==='synth'&&<>
            <div style={{fontSize:6.75,color:'rgba(255,255,255,0.92)',letterSpacing:'0.1em',marginBottom:2,textTransform:'uppercase'}}>SECTION GENERATOR</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2}}>
              {Object.keys(SECTIONS).map(sec=>(
                <button key={sec} onClick={()=>regenerateSection(sec)} style={{
                  padding:'5px 3px',borderRadius:2,border:`1px solid ${currentSectionName===sec?gc:'rgba(255,255,255,0.08)'}`,
                  background:currentSectionName===sec?`${gc}18`:'rgba(255,255,255,0.02)',
                  color:currentSectionName===sec?gc:'rgba(255,255,255,0.96)',
                  fontSize:7.75,cursor:'pointer',fontFamily:'Space Mono,monospace',letterSpacing:'0.05em',textTransform:'uppercase',
                }}>{sec}</button>
              ))}
            </div>
            <div style={{marginTop:3,fontSize:7.25,color:'rgba(255,255,255,0.88)',lineHeight:1.5}}>
              Click to regenerate with that section's feel.
            </div>
            <div style={{marginTop:4}}>
              <div style={{fontSize:6.75,color:'rgba(255,255,255,0.92)',letterSpacing:'0.1em',marginBottom:2,textTransform:'uppercase'}}>SYNTH EXPRESSION</div>
              {[
                {l:'CHORD CHANCE',v:synthChordChance,s:setSynthChordChance,c:'#c084fc'},
                {l:'HOLD',v:synthHold,s:setSynthHold,c:'#7dd3fc'},
              ].map(({l,v,s,c})=>(
                <div key={l}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:0}}>
                    <span style={{fontSize:6.75,letterSpacing:'0.08em',color:'rgba(255,255,255,0.94)',textTransform:'uppercase'}}>{l}</span>
                    <span style={{fontSize:6.75,color:c,fontFamily:'Space Mono,monospace'}}>{(v*100).toFixed(0)}</span>
                  </div>
                  <input type="range" min={0} max={1} step={0.01} value={v} onChange={e=>s(Number(e.target.value))} style={{width:'100%',accentColor:c,color:c,height:12}}/>
                </div>
              ))}
              <label style={{display:'flex',flexDirection:'column',gap:2,marginTop:4}}>
                <span style={{fontSize:6.75,color:'rgba(255,255,255,0.93)',letterSpacing:'0.12em',textTransform:'uppercase'}}>SYNTH CURVE</span>
                <select value={synthCurve} onChange={e=>setSynthCurve(e.target.value)} style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${gc}33`,color:gc,borderRadius:4,padding:'5px 7px',fontSize:7.75,fontFamily:'Space Mono,monospace',outline:'none'}}>
                  {SYNTH_CURVES.map(cur=><option key={cur} value={cur} style={{color:'#111',background:'#f2f2f2'}}>{cur}</option>)}
                </select>
              </label>
            </div>
          </>}

          {tab==='session'&&<>
            {/* Recording */}
            <button onClick={recState==='idle'?startRec:stopRec} style={{
              padding:'7px',borderRadius:3,border:`1px solid ${recState==='recording'?'#ff2244':'rgba(255,255,255,0.12)'}`,
              background:recState==='recording'?'rgba(255,34,68,0.12)':'rgba(255,255,255,0.03)',
              color:recState==='recording'?'#ff2244':'rgba(255,255,255,0.55)',
              fontSize:8.5,fontWeight:700,cursor:'pointer',fontFamily:'Space Mono,monospace',letterSpacing:'0.1em',textAlign:'center',
            }}>{recState==='recording'?'■ STOP REC':'● REC'}</button>
            {recordings.map((r,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:3,padding:'3px 5px',borderRadius:3,background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.05)'}}>
                <audio src={r.url} controls style={{flex:1,height:22,filter:'invert(1)',opacity:0.65}}/>
                <a href={r.url} download={r.name} style={{color:gc,fontSize:7.25,textDecoration:'none',fontFamily:'Space Mono,monospace'}}>DL</a>
              </div>
            ))}

            <div style={{height:1,background:'rgba(255,255,255,0.06)',margin:'4px 0'}}/>

            {/* Scenes */}
            <div style={{fontSize:7.75,color:'rgba(255,255,255,0.94)',letterSpacing:'0.12em',marginBottom:2,textTransform:'uppercase'}}>SCENES (6)</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:3}}>
              {savedScenes.map((sc,i)=>(
                <div key={i} style={{display:'flex',flexDirection:'column',gap:1}}>
                  <button onClick={()=>loadScene(i)} style={{
                    padding:'5px',borderRadius:3,border:`1px solid ${sc?gc+'44':'rgba(255,255,255,0.08)'}`,
                    background:sc?`${gc}0d`:'rgba(255,255,255,0.02)',
                    color:sc?gc:'rgba(255,255,255,0.92)',
                    fontSize:8.5,cursor:'pointer',fontFamily:'Space Mono,monospace',textAlign:'center',
                  }}>S{i+1}{sc?` ◆`:''}</button>
                  <button onClick={()=>saveScene(i)} style={{padding:'2px',borderRadius:2,border:'1px solid rgba(255,255,255,0.07)',background:'rgba(255,255,255,0.02)',color:'rgba(255,255,255,0.94)',fontSize:6.75,cursor:'pointer',fontFamily:'Space Mono,monospace',textAlign:'center'}}>SAVE</button>
                </div>
              ))}
            </div>

            <div style={{height:1,background:'rgba(255,255,255,0.06)',margin:'4px 0'}}/>

            {/* Export/Import */}
            <button onClick={exportJSON} style={{padding:'7px',borderRadius:3,border:`1px solid ${gc}44`,background:`${gc}0d`,color:gc,fontSize:8.5,cursor:'pointer',fontFamily:'Space Mono,monospace',letterSpacing:'0.1em',textAlign:'center',textTransform:'uppercase'}}>EXPORT JSON</button>
            <button onClick={()=>importRef.current?.click()} style={{padding:'7px',borderRadius:3,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.03)',color:'rgba(255,255,255,0.5)',fontSize:8.5,cursor:'pointer',fontFamily:'Space Mono,monospace',letterSpacing:'0.1em',textAlign:'center',textTransform:'uppercase'}}>IMPORT JSON</button>
            <input ref={importRef} type="file" accept=".json" onChange={importJSON} style={{display:'none'}}/>

            <div style={{height:1,background:'rgba(255,255,255,0.06)',margin:'2px 0'}}/>
            <div style={{fontSize:7.25,color:'rgba(255,255,255,0.9)',lineHeight:1.7,letterSpacing:'0.06em'}}>
              SHORTCUTS<br/>
              SPACE = play/stop<br/>
              A=drop S=break D=build<br/>
              F=groove G=tension H=fill<br/>
              M=mutate R=regen P=autopilot<br/>
              T=tap tempo Z=undo
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SONG VIEW — arc composer and arrangement
// ─────────────────────────────────────────────────────────────────────────────
function SongView({genre,gc,songArc,arcIdx,songActive,startSongArc,stopSongArc,currentSectionName,SONG_ARCS,SECTIONS,triggerSection,modeName,arpeMode,bpm,compact,phone}){
  const SECTION_COLORS={drop:'#ff2244',break:'#4488ff',build:'#ffaa00',groove:'#00cc66',tension:'#ff6622',fill:'#cc00ff',intro:'#44ffcc',outro:'#aaaaaa'};
  const gd=GENRES[genre];

  return(
    <div style={{flex:1,display:'flex',flexDirection:compact?'column':'row',gap:8,padding:phone?'8px':'6px 12px 12px 12px',minHeight:0,overflowY:'auto',overflowX:'hidden'}}>

      {/* LEFT — Genre info + arc control */}
      <div style={{width:compact?'100%':260,display:'flex',flexDirection:'column',gap:8,flexShrink:0}}>
        {/* Genre card */}
        <div style={{padding:16,borderRadius:8,border:`1px solid ${gc}33`,background:`${gc}08`}}>
          <div style={{fontSize:18,fontWeight:700,color:gc,letterSpacing:'0.2em',textTransform:'uppercase',marginBottom:4}}>{genre}</div>
          <div style={{fontSize:9,color:'rgba(255,255,255,0.96)',letterSpacing:'0.08em',marginBottom:8}}>{gd.description}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
            {[
              {l:'BPM',v:`${gd.bpm[0]}–${gd.bpm[1]}`},
              {l:'CURRENT',v:bpm},
              {l:'MODE',v:modeName},
              {l:'ARP',v:arpeMode},
              {l:'DENSITY',v:`${Math.round(gd.density*100)}%`},
              {l:'CHAOS',v:`${Math.round(gd.chaos*100)}%`},
              {l:'NOISE',v:gd.noiseColor},
              {l:'BASS',v:gd.bassMode},
            ].map(({l,v})=>(
              <div key={l}>
                <div style={{fontSize:6.75,color:'rgba(255,255,255,0.92)',letterSpacing:'0.12em',textTransform:'uppercase'}}>{l}</div>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.7)',fontFamily:'Space Mono,monospace'}}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Arc control */}
        <button onClick={songActive?stopSongArc:startSongArc} style={{
          padding:'12px',borderRadius:6,border:`1px solid ${songActive?'#ff2244':gc}`,
          background:songActive?'rgba(255,34,68,0.12)':`${gc}18`,
          color:songActive?'#ff2244':gc,
          fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'Space Mono,monospace',
          letterSpacing:'0.15em',textTransform:'uppercase',
          boxShadow:songActive?'0 0 16px rgba(255,34,68,0.3)':`0 0 16px ${gc}33`,
        }}>{songActive?'■ STOP ARC':'▶ START ARC'}</button>

        {songActive&&(
          <div style={{padding:10,borderRadius:6,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.02)'}}>
            <div style={{fontSize:7.75,color:'rgba(255,255,255,0.94)',letterSpacing:'0.12em',marginBottom:6,textTransform:'uppercase'}}>ARC PROGRESS</div>
            <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
              {songArc.map((s,i)=>{
                const sc=SECTION_COLORS[s]||'#ffffff';
                return(
                  <div key={i} style={{
                    padding:'4px 8px',borderRadius:3,
                    background:i===arcIdx?`${sc}33`:i<arcIdx?`${sc}11`:'rgba(255,255,255,0.03)',
                    border:`1px solid ${i===arcIdx?sc:i<arcIdx?`${sc}44`:'rgba(255,255,255,0.06)'}`,
                    color:i===arcIdx?sc:i<arcIdx?`${sc}88`:'rgba(255,255,255,0.92)',
                    fontSize:8.5,fontFamily:'Space Mono,monospace',fontWeight:700,
                    transition:'all 0.2s',
                  }}>{s}</div>
                );
              })}
            </div>
          </div>
        )}

        {/* Preset arcs */}
        <div style={{fontSize:7.75,color:'rgba(255,255,255,0.92)',letterSpacing:'0.15em',textTransform:'uppercase',marginTop:4}}>PRESET ARCS</div>
        {SONG_ARCS.map((arc,i)=>(
          <button key={i} onClick={()=>{}} style={{
            padding:'8px 10px',borderRadius:4,border:'1px solid rgba(255,255,255,0.08)',
            background:'rgba(255,255,255,0.02)',color:'rgba(255,255,255,0.97)',
            fontSize:7.75,cursor:'pointer',fontFamily:'Space Mono,monospace',textAlign:'left',
            letterSpacing:'0.04em',lineHeight:1.4,
          }}>
            {arc.join(' → ')}
          </button>
        ))}
      </div>

      {/* RIGHT — Section library + direct trigger */}
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
        <div style={{fontSize:7.75,color:'rgba(255,255,255,0.92)',letterSpacing:'0.2em',textTransform:'uppercase'}}>SECTION LIBRARY — CLICK TO TRIGGER</div>
        <div style={{display:'grid',gridTemplateColumns:phone?'repeat(2,1fr)':'repeat(4,1fr)',gap:6}}>
          {Object.entries(SECTIONS).map(([name,data])=>{
            const sc=SECTION_COLORS[name]||'#ffffff';
            const isActive=currentSectionName===name;
            return(
              <button key={name} onClick={()=>triggerSection(name)} style={{
                padding:'18px 12px',borderRadius:6,border:`1px solid ${isActive?sc:sc+'33'}`,
                background:isActive?`${sc}18`:`${sc}06`,
                color:isActive?sc:`${sc}88`,
                cursor:'pointer',fontFamily:'Space Mono,monospace',
                textAlign:'left',transition:'all 0.1s',
                boxShadow:isActive?`0 0 16px ${sc}44`:'none',
              }}>
                <div style={{fontSize:13,fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:6}}>{name}</div>
                <div style={{fontSize:7.75,opacity:0.7,lineHeight:1.6}}>
                  {`k:${Math.round(data.kM*100)}% h:${Math.round(data.hM*100)}%`}<br/>
                  {`b:${Math.round(data.bM*100)}% sy:${Math.round(data.syM*100)}%`}<br/>
                  {`len:${data.lb}x vel:${data.vel}`}<br/>
                  {`${data.bars} bars`}
                </div>
              </button>
            );
          })}
        </div>

        {/* Current section info */}
        <div style={{padding:12,borderRadius:6,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.02)',marginTop:4}}>
          <div style={{fontSize:7.75,color:'rgba(255,255,255,0.92)',letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:6}}>CURRENT SESSION</div>
          <div style={{display:'grid',gridTemplateColumns:phone?'repeat(2,1fr)':'repeat(5,1fr)',gap:8}}>
            {[
              {l:'GENRE',v:genre},{l:'SECTION',v:currentSectionName},{l:'MODE',v:modeName},
              {l:'ARP',v:arpeMode},{l:'STATUS',v:songActive?`arc[${arcIdx+1}/${songArc.length}]`:'manual'},
            ].map(({l,v})=>(
              <div key={l}>
                <div style={{fontSize:6.75,color:'rgba(255,255,255,0.9)',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:2}}>{l}</div>
                <div style={{fontSize:9,color:gc,fontFamily:'Space Mono,monospace',fontWeight:700}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
