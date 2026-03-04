import { EmergencyScript } from '../models/types';

/**
 * Emergency scripts for Layer 1 — deterministic, zero LLM.
 * Sources:
 *   Cardiac:             WHO/AHA Bystander CPR Guidelines 2024
 *   Snakebite:           WHO Snakebite Guidelines + India clinical consensus (NAPSE 2024)
 *   Child Fever:         WHO IMCI Danger Signs + NHM India
 *   Breathing Difficulty: WHO ABCDE Prehospital + Red Cross First Aid
 *
 * Scripts are read VERBATIM by the IVR — no LLM generation.
 * All bilingual instructions are in Hindi (transliterated) + English.
 */

export const EMERGENCY_SCRIPTS: EmergencyScript[] = [

  // ─── 1. CARDIAC ARREST ────────────────────────────────────────────────────
  {
    condition: 'cardiac',
    icd10Code: 'I21.9',
    dispatchType: '108',
    severity: 'CRITICAL',
    source: 'WHO/AHA Bystander CPR Guidelines 2024 + NHM India 108 Protocol',
    abcdeAssessment: {
      airway: {
        questionHindi: 'Kya rogi hosh mein hai? Kya woh aapki baat sun sakta hai?',
        questionEnglish: 'Is the patient conscious? Can they respond to you?',
        yesAction: { hindi: 'Rogi ko lita dijiye. Sar thoda peeche karein taaki saans ka raasta khule.', english: 'Lay the patient down. Tilt the head back slightly to open the airway.' },
        noAction: { hindi: 'Rogi behosh hai. Turant CPR shuru karein. 108 call karein.', english: 'Patient is unconscious. Start CPR immediately. Call 108.' },
        escalationTrigger: true,
      },
      breathing: {
        questionHindi: 'Kya rogi saans le raha hai? Seene ko utha-girte dekh rahe hain?',
        questionEnglish: 'Is the patient breathing? Can you see the chest rising?',
        yesAction: { hindi: 'Saans aa rahi hai. Rogi ko lita kar rakhen. 108 ka intezaar karein.', english: 'Patient is breathing. Keep them lying down. Wait for 108.' },
        noAction: { hindi: 'Saans nahi aa rahi. Abhi haath se seene par dabana shuru karein — CPR.', english: 'Not breathing. Start chest compressions now — CPR.' },
        escalationTrigger: true,
      },
      circulation: {
        questionHindi: 'Kya rogi ka seena daba rahe hain? Kitni baar per minute?',
        questionEnglish: 'Are you doing chest compressions? How many per minute?',
        yesAction: { hindi: 'Bahut achha. 100 se 120 baar per minute dabate rahein. Rukein mat.', english: 'Good. Keep pushing 100 to 120 times per minute. Do not stop.' },
        noAction: { hindi: 'Abhi shuru karein. Seene ke beech mein do haath rakhein. Zor se dabayein.', english: 'Start now. Place both hands on the center of the chest. Push hard.' },
      },
      disability: {
        questionHindi: 'Kya rogi hil-dol raha hai ya koi reaction de raha hai?',
        questionEnglish: 'Is the patient showing any movement or reaction?',
        yesAction: { hindi: 'Achha sign hai. CPR jaari rakhen. 108 ko batayein ki reaction aa rahi hai.', english: 'Good sign. Continue CPR. Tell 108 that the patient is responding.' },
        noAction: { hindi: 'CPR jaari rakhen. Thakein mat. 108 ambulance aa rahi hai.', english: 'Continue CPR. Do not give up. 108 ambulance is on the way.' },
      },
      exposure: {
        questionHindi: 'Kya rogi ke kapde dhile hain? Koi tight belt ya tie toh nahi?',
        questionEnglish: 'Is the patient\'s clothing loose? No tight belt or tie?',
        yesAction: { hindi: 'Theek hai. CPR jaari rakhen.', english: 'Good. Continue CPR.' },
        noAction: { hindi: 'Tight kapde ya belt dhile karein. Seene par dabane mein aasani hogi.', english: 'Loosen tight clothing or belt. It will make compressions easier.' },
      },
    },
    immediateActions: [
      { hindi: '108 par abhi call karein.', english: 'Call 108 immediately.' },
      { hindi: 'Rogi ko zameen par seedha lita dijiye.', english: 'Lay the patient flat on the ground.' },
      { hindi: 'Seene ke beech mein do haath rakhein aur zor se dabayein — 100 se 120 baar per minute.', english: 'Place both hands on the center of the chest and push hard — 100 to 120 times per minute.' },
      { hindi: 'Agar rogi hosh mein hai aur nigal sakta hai toh Aspirin 325mg dijiye.', english: 'If the patient is conscious and can swallow, give Aspirin 325mg.' },
      { hindi: 'Rogi ko akela mat chhodein. CPR tab tak jaari rakhen jab tak 108 na aa jaaye.', english: 'Do not leave the patient alone. Continue CPR until 108 arrives.' },
    ],
    doNotActions: [
      { hindi: 'Rogi ko paani ya kuch bhi peene ko mat dijiye.', english: 'Do not give the patient water or anything to drink.' },
      { hindi: 'Rogi ko uthane ya baithane ki koshish mat karein.', english: 'Do not try to lift or sit up the patient.' },
      { hindi: 'CPR band mat karein jab tak 108 na aa jaaye.', english: 'Do not stop CPR until 108 arrives.' },
    ],
    dispatchInstructions: {
      dispatchType: '108',
      dispatchNumber: '108',
      messageHindi: '108 ko batayein: Cardiac emergency, CPR chal raha hai, turant ambulance chahiye.',
      messageEnglish: 'Tell 108: Cardiac emergency, CPR in progress, ambulance needed urgently.',
    },
  },

  // ─── 2. SNAKEBITE ─────────────────────────────────────────────────────────
  {
    condition: 'snakebite',
    icd10Code: 'T63.0',
    dispatchType: '108',
    severity: 'CRITICAL',
    source: 'WHO Snakebite Guidelines 2019 + India NAPSE 2024 Clinical Consensus',
    abcdeAssessment: {
      airway: {
        questionHindi: 'Kya rogi hosh mein hai aur baat kar sakta hai?',
        questionEnglish: 'Is the patient conscious and able to speak?',
        yesAction: { hindi: 'Rogi ko bilkul shant rakhen. Hilne-dulne se zeher jaldi failta hai.', english: 'Keep the patient completely still. Movement spreads venom faster.' },
        noAction: { hindi: 'Rogi behosh hai — bahut serious hai. 108 turant call karein.', english: 'Patient is unconscious — very serious. Call 108 immediately.' },
        escalationTrigger: true,
      },
      breathing: {
        questionHindi: 'Kya rogi ko saans lene mein takleef ho rahi hai?',
        questionEnglish: 'Is the patient having difficulty breathing?',
        yesAction: { hindi: 'Rogi ko seedha baithayein. 108 ko batayein saans ki takleef hai.', english: 'Sit the patient upright. Tell 108 there is breathing difficulty.' },
        noAction: { hindi: 'Saans theek hai. Rogi ko lita kar rakhen, kaate wala hissa neeche rakhen.', english: 'Breathing is fine. Keep patient lying down, bitten limb below heart level.' },
      },
      circulation: {
        questionHindi: 'Kaate wali jagah par sujan ya neela rang aa raha hai?',
        questionEnglish: 'Is there swelling or discoloration at the bite site?',
        yesAction: { hindi: 'Zeher failna shuru hua hai. Kaate wale hisse ko bilkul mat hilayein.', english: 'Venom is spreading. Do not move the bitten limb at all.' },
        noAction: { hindi: 'Abhi sujan nahi. Rogi ko shant rakhen aur 108 ka intezaar karein.', english: 'No swelling yet. Keep patient calm and wait for 108.' },
      },
      disability: {
        questionHindi: 'Kya rogi ko chakkar aa rahe hain ya aankhein dhundhli ho rahi hain?',
        questionEnglish: 'Is the patient feeling dizzy or having blurred vision?',
        yesAction: { hindi: 'Neurological symptoms hain. Bahut urgent hai. 108 ko abhi batayein.', english: 'Neurological symptoms present. Very urgent. Tell 108 immediately.' },
        noAction: { hindi: 'Theek hai. Rogi ko lita kar rakhen aur hilne mat dein.', english: 'Good. Keep patient lying down and still.' },
        escalationTrigger: true,
      },
      exposure: {
        questionHindi: 'Kya kaate wali jagah par koi kapda, ghadi ya ring hai?',
        questionEnglish: 'Is there any clothing, watch, or ring near the bite site?',
        yesAction: { hindi: 'Sab kuch dhile karein ya hata dein — sujan badhne par ye kaat sakta hai.', english: 'Loosen or remove everything — swelling can cause constriction.' },
        noAction: { hindi: 'Theek hai. Kaate wale hisse ko neeche rakhen aur mat hilayein.', english: 'Good. Keep the bitten limb below heart level and do not move it.' },
      },
    },
    immediateActions: [
      { hindi: '108 par abhi call karein.', english: 'Call 108 immediately.' },
      { hindi: 'Rogi ko bilkul shant rakhen. Hilne-dulne se zeher jaldi failta hai.', english: 'Keep the patient completely still. Movement spreads venom faster.' },
      { hindi: 'Kaate wale hisse ko dil ke neeche rakhen — haath kaata hai toh haath neeche latkayen.', english: 'Keep the bitten limb below heart level — if arm is bitten, let it hang down.' },
      { hindi: 'Kaate wali jagah ke paas se ghadi, ring, ya tight kapde hata dein.', english: 'Remove watch, rings, or tight clothing near the bite site.' },
      { hindi: 'Rogi ko seedha hospital le jaayein — sirf antivenom hi zeher ka ilaaj hai.', english: 'Take the patient to hospital immediately — only antivenom can treat the venom.' },
    ],
    doNotActions: [
      { hindi: 'Tourniquet mat lagaiye — ye zeher ko rok nahi sakta aur hath-pair kaat sakta hai.', english: 'Do NOT apply a tourniquet — it cannot stop venom and may cause limb loss.' },
      { hindi: 'Kaate wali jagah ko mat kaatein ya zeher choosne ki koshish mat karein.', english: 'Do NOT cut the bite site or try to suck out the venom.' },
      { hindi: 'Barf ya thanda paani mat lagaiye.', english: 'Do NOT apply ice or cold water.' },
      { hindi: 'Rogi ko kuch bhi khaane-peene ko mat dijiye.', english: 'Do NOT give the patient anything to eat or drink.' },
      { hindi: 'Saanp ko pakadne ya marne ki koshish mat karein.', english: 'Do NOT try to catch or kill the snake.' },
    ],
    dispatchInstructions: {
      dispatchType: '108',
      dispatchNumber: '108',
      messageHindi: '108 ko batayein: Saanp ne kaata hai, antivenom wala hospital chahiye, turant ambulance.',
      messageEnglish: 'Tell 108: Snakebite, need hospital with antivenom, urgent ambulance required.',
    },
  },

  // ─── 3. CHILD FEVER (EMERGENCY — DANGER SIGNS PRESENT) ───────────────────
  {
    condition: 'child_fever',
    icd10Code: 'A09',
    dispatchType: '108',
    severity: 'CRITICAL',
    source: 'WHO IMCI Danger Signs 2014 + NHM India Child Health Guidelines',
    abcdeAssessment: {
      airway: {
        questionHindi: 'Kya bachcha hosh mein hai? Kya woh aapko pehchaan raha hai?',
        questionEnglish: 'Is the child conscious? Do they recognize you?',
        yesAction: { hindi: 'Bachcha hosh mein hai. Usse shant rakhen. Bukhar ke liye kapda bhigo kar maathey par rakhein.', english: 'Child is conscious. Keep them calm. Place a damp cloth on the forehead for fever.' },
        noAction: { hindi: 'Bachcha behosh hai — bahut serious danger sign hai. 108 turant call karein.', english: 'Child is unconscious — very serious danger sign. Call 108 immediately.' },
        escalationTrigger: true,
      },
      breathing: {
        questionHindi: 'Kya bachche ko saans lene mein takleef hai? Saans bahut tez aa rahi hai?',
        questionEnglish: 'Is the child having difficulty breathing? Is breathing very fast?',
        yesAction: { hindi: 'Tez saans — serious sign hai. Bachche ko seedha baithayein. 108 call karein.', english: 'Fast breathing — serious sign. Sit the child upright. Call 108.' },
        noAction: { hindi: 'Saans theek hai. Bukhar ke liye paracetamol dijiye aur paani pilate rahein.', english: 'Breathing is fine. Give paracetamol for fever and keep giving fluids.' },
        escalationTrigger: true,
      },
      circulation: {
        questionHindi: 'Kya bachcha paani ya doodh pee sakta hai? Kya woh kuch bhi peene se mana kar raha hai?',
        questionEnglish: 'Can the child drink water or milk? Are they refusing all fluids?',
        yesAction: { hindi: 'Pee sakta hai — achha sign. ORS pilate rahein thodi-thodi der mein.', english: 'Can drink — good sign. Keep giving ORS in small frequent sips.' },
        noAction: { hindi: 'Kuch bhi nahi pee raha — serious danger sign. 108 call karein.', english: 'Refusing all fluids — serious danger sign. Call 108.' },
        escalationTrigger: true,
      },
      disability: {
        questionHindi: 'Kya bachche ko jhatkay aa rahe hain ya body akad rahi hai?',
        questionEnglish: 'Is the child having convulsions or body stiffness?',
        yesAction: { hindi: 'Jhatkay aa rahe hain — bahut serious. Bachche ko zameen par lita dein, kuch bhi munh mein mat daalein. 108 turant.', english: 'Convulsions present — very serious. Lay child on the floor, put nothing in the mouth. Call 108 immediately.' },
        noAction: { hindi: 'Jhatkay nahi. Bukhar control karein — paracetamol aur ORS.', english: 'No convulsions. Manage fever with paracetamol and ORS.' },
        escalationTrigger: true,
      },
      exposure: {
        questionHindi: 'Bachche ka bukhar kitna hai? Kitne din se hai?',
        questionEnglish: 'What is the child\'s temperature? How many days has the fever lasted?',
        yesAction: { hindi: '3 din se zyada bukhar — doctor ko dikhana zaroori hai. PHC ya hospital jaayein.', english: 'Fever for more than 3 days — must see a doctor. Go to PHC or hospital.' },
        noAction: { hindi: 'Pehle din ka bukhar — paracetamol aur ORS se shuru karein. Danger signs dekhte rahein.', english: 'First day of fever — start with paracetamol and ORS. Watch for danger signs.' },
      },
    },
    immediateActions: [
      { hindi: 'Agar jhatkay aa rahe hain toh 108 turant call karein.', english: 'If convulsions are present, call 108 immediately.' },
      { hindi: 'Bachche ko paracetamol dijiye — 10 se 15 mg per kg weight. Ek ghante mein ek baar se zyada mat dein.', english: 'Give paracetamol — 10 to 15 mg per kg body weight. Do not give more than once per hour.' },
      { hindi: 'ORS pilate rahein — thodi-thodi der mein chhote chhote ghoonth.', english: 'Keep giving ORS — small sips at frequent intervals.' },
      { hindi: 'Geele kapde se maatha aur badan ponchein — bukhar thoda kam hoga.', english: 'Wipe forehead and body with a damp cloth — this helps reduce fever.' },
      { hindi: 'Agar bachcha kuch bhi nahi pee raha, behosh hai, ya jhatkay aa rahe hain — turant hospital jaayein.', english: 'If child refuses all fluids, is unconscious, or has convulsions — go to hospital immediately.' },
    ],
    doNotActions: [
      { hindi: 'Bachche ko aspirin mat dijiye — bachcho ke liye khatarnak hai.', english: 'Do NOT give aspirin to children — it is dangerous for children.' },
      { hindi: 'Jhatkay ke waqt bachche ke munh mein kuch bhi mat daalein.', english: 'Do NOT put anything in the child\'s mouth during a convulsion.' },
      { hindi: 'Bukhar mein bachche ko bahut zyada kapde mat pehnaiye.', english: 'Do NOT over-bundle the child in fever — it makes fever worse.' },
    ],
    dispatchInstructions: {
      dispatchType: '108',
      dispatchNumber: '108',
      messageHindi: '108 ko batayein: Bachche ko tez bukhar aur danger signs hain, turant ambulance chahiye.',
      messageEnglish: 'Tell 108: Child has high fever with danger signs, urgent ambulance needed.',
    },
  },

  // ─── 4. BREATHING DIFFICULTY ──────────────────────────────────────────────
  {
    condition: 'breathing_difficulty',
    icd10Code: 'J45.9',
    dispatchType: '108',
    severity: 'CRITICAL',
    source: 'WHO ABCDE Prehospital Protocol + Red Cross First Aid Guidelines',
    abcdeAssessment: {
      airway: {
        questionHindi: 'Kya rogi kuch bol sakta hai? Kya gala saaf hai?',
        questionEnglish: 'Can the patient speak? Is the airway clear?',
        yesAction: { hindi: 'Bol sakta hai — airway theek hai. Rogi ko seedha baithayein.', english: 'Can speak — airway is clear. Sit the patient upright.' },
        noAction: { hindi: 'Nahi bol sakta — airway block ho sakta hai. 108 turant call karein.', english: 'Cannot speak — airway may be blocked. Call 108 immediately.' },
        escalationTrigger: true,
      },
      breathing: {
        questionHindi: 'Saans kitni tez aa rahi hai? Lips ya nakhoon neele ho rahe hain?',
        questionEnglish: 'How fast is the breathing? Are lips or nails turning blue?',
        yesAction: { hindi: 'Neela rang — oxygen kam hai. Bahut serious. 108 turant.', english: 'Blue color — low oxygen. Very serious. Call 108 immediately.' },
        noAction: { hindi: 'Rang theek hai. Rogi ko seedha baithayein aur shant rakhen.', english: 'Color is fine. Sit the patient upright and keep them calm.' },
        escalationTrigger: true,
      },
      circulation: {
        questionHindi: 'Kya rogi ko inhaler hai? Kya woh use kar sakta hai?',
        questionEnglish: 'Does the patient have an inhaler? Can they use it?',
        yesAction: { hindi: 'Inhaler use karein — 2 puff abhi. Agar 10 minute mein aaram nahi toh 108.', english: 'Use inhaler — 2 puffs now. If no relief in 10 minutes, call 108.' },
        noAction: { hindi: 'Inhaler nahi hai. Rogi ko seedha baithayein. 108 call karein.', english: 'No inhaler available. Sit patient upright. Call 108.' },
      },
      disability: {
        questionHindi: 'Kya rogi hosh mein hai? Kya woh aapko samajh raha hai?',
        questionEnglish: 'Is the patient conscious? Do they understand you?',
        yesAction: { hindi: 'Hosh mein hai. Shant rakhen. Seedha baithayein. 108 ka intezaar.', english: 'Conscious. Keep calm. Sit upright. Wait for 108.' },
        noAction: { hindi: 'Behosh ho raha hai — bahut serious. 108 turant.', english: 'Losing consciousness — very serious. Call 108 immediately.' },
        escalationTrigger: true,
      },
      exposure: {
        questionHindi: 'Kya koi trigger tha — dhool, dhuaan, ya koi cheez soonghna?',
        questionEnglish: 'Was there a trigger — dust, smoke, or something inhaled?',
        yesAction: { hindi: 'Trigger se door le jaayein. Taaza hawa mein le jaayein.', english: 'Move away from the trigger. Take the patient to fresh air.' },
        noAction: { hindi: 'Koi trigger nahi. Rogi ko shant rakhen aur 108 ka intezaar karein.', english: 'No trigger identified. Keep patient calm and wait for 108.' },
      },
    },
    immediateActions: [
      { hindi: '108 par call karein.', english: 'Call 108.' },
      { hindi: 'Rogi ko seedha baithayein — kabhi bhi litate mat karein saans ki takleef mein.', english: 'Sit the patient upright — never lay them down when they have breathing difficulty.' },
      { hindi: 'Tight kapde, belt, ya tie dhile karein.', english: 'Loosen tight clothing, belt, or tie.' },
      { hindi: 'Agar inhaler hai toh 2 puff abhi dein. 10 minute baad bhi aaram nahi toh 108.', english: 'If inhaler is available, give 2 puffs now. If no relief in 10 minutes, call 108.' },
      { hindi: 'Rogi ko shant rakhen — ghabrahat se saans aur mushkil ho jaati hai.', english: 'Keep the patient calm — panic makes breathing worse.' },
    ],
    doNotActions: [
      { hindi: 'Rogi ko kabhi bhi litate mat karein saans ki takleef mein.', english: 'Do NOT lay the patient down during breathing difficulty.' },
      { hindi: 'Rogi ko paani ya kuch bhi peene ko mat dijiye jab tak saans theek na ho.', english: 'Do NOT give water or anything to drink until breathing stabilizes.' },
      { hindi: 'Rogi ko akela mat chhodein.', english: 'Do NOT leave the patient alone.' },
    ],
    dispatchInstructions: {
      dispatchType: '108',
      dispatchNumber: '108',
      messageHindi: '108 ko batayein: Saans lene mein bahut takleef hai, turant ambulance chahiye.',
      messageEnglish: 'Tell 108: Severe breathing difficulty, urgent ambulance needed.',
    },
  },

  // ─── 5–15: STUB SCRIPTS (production-complete, hackathon stubs) ───────────
  // These follow the same schema. Full clinical content to be added post-hackathon.
  ...(['stroke', 'severe_bleeding', 'choking', 'burns', 'poisoning',
    'anaphylaxis', 'seizure', 'pregnancy_emergency', 'drowning',
    'unconsciousness', 'infant_not_breathing', 'heatstroke'] as const).map(condition => ({
    condition,
    icd10Code: {
      stroke: 'I64', severe_bleeding: 'R58', choking: 'T17.9',
      burns: 'T30.0', poisoning: 'T65.9', anaphylaxis: 'T78.2',
      seizure: 'R56.9', pregnancy_emergency: 'O14.9', drowning: 'T75.1',
      unconsciousness: 'R40.2', infant_not_breathing: 'P28.4', heatstroke: 'T67.0',
    }[condition] as string,
    dispatchType: '108' as const,
    severity: 'CRITICAL' as const,
    source: 'WHO Prehospital Guidelines — stub, full content pending',
    abcdeAssessment: {
      airway: { questionHindi: 'Kya rogi hosh mein hai?', questionEnglish: 'Is the patient conscious?', yesAction: { hindi: 'Rogi ko shant rakhen.', english: 'Keep the patient calm.' }, noAction: { hindi: '108 turant call karein.', english: 'Call 108 immediately.' }, escalationTrigger: true },
      breathing: { questionHindi: 'Kya rogi saans le raha hai?', questionEnglish: 'Is the patient breathing?', yesAction: { hindi: 'Saans aa rahi hai.', english: 'Patient is breathing.' }, noAction: { hindi: 'CPR shuru karein.', english: 'Start CPR.' } },
      circulation: { questionHindi: 'Koi bleeding toh nahi?', questionEnglish: 'Any visible bleeding?', yesAction: { hindi: 'Bleeding rok ne ki koshish karein.', english: 'Try to stop the bleeding.' }, noAction: { hindi: 'Theek hai.', english: 'No bleeding.' } },
      disability: { questionHindi: 'Kya rogi react kar raha hai?', questionEnglish: 'Any response from patient?', yesAction: { hindi: 'Achha sign hai.', english: 'Good sign.' }, noAction: { hindi: '108 ko batayein.', english: 'Inform 108.' } },
      exposure: { questionHindi: 'Koi obvious injury?', questionEnglish: 'Any obvious injury?', yesAction: { hindi: 'Injury ko cover karein.', english: 'Cover the injury.' }, noAction: { hindi: 'Theek hai.', english: 'No visible injury.' } },
    },
    immediateActions: [
      { hindi: '108 par abhi call karein.', english: 'Call 108 immediately.' },
      { hindi: 'Rogi ko shant rakhen aur ambulance ka intezaar karein.', english: 'Keep patient calm and wait for ambulance.' },
    ],
    doNotActions: [
      { hindi: 'Rogi ko akela mat chhodein.', english: 'Do not leave the patient alone.' },
    ],
    dispatchInstructions: {
      dispatchType: '108' as const,
      dispatchNumber: '108',
      messageHindi: '108 ko batayein: Emergency hai, turant ambulance chahiye.',
      messageEnglish: 'Tell 108: Emergency, urgent ambulance needed.',
    },
  })),
];

