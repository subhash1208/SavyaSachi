# SavyaSachi - AI for Bharat 2026 Hackathon

**Team Name:** SavyaSachi  
**Project:** VaidyaVaani (वैद्यवाणी) - AI-Powered IVR Health Assistant

---

## 🎯 Project Overview

**VaidyaVaani** means "Doctor's Voice" - an AI-powered IVR system that ANY Indian can call from ANY phone (feature phone, smartphone, landline) to get instant health triage, symptom assessment, and emergency dispatch — in their native language, 24/7, without internet or literacy.

**The Problem:** 900 million rural Indians, 350 million feature phone users, only 3 doctors per 10,000 people in rural areas. When a medical emergency strikes at 2 AM, there's NO ONE to call.

**The Solution:** Voice-first AI healthcare accessible to everyone, especially the 350 million Indians who have feature phones but no smartphone.

---

## 👥 Team Information

**Team Name:** SavyaSachi  
**Team Composition:**
- 2 Professionals
- 2 Students
- Total: 4 members

**Hackathon:** AI for Bharat 2026  
**Organizer:** Hack2Skill + AWS  
**Track:** Healthcare & Life Sciences (Student Track)

---

## 📁 Repository Structure

```
SavyaSachi/
├── README.md (this file - Team info + Submission requirements)
├── requirements.md (To be generated via Kiro)
├── design.md (To be generated via Kiro)
├── VaidyaVaani/
│   ├── README.md (Complete project documentation)
│   ├── VaidyaVaani-Final-Presentation.md (Complete presentation - 40 KB)
│   ├── VaidyaVaani-Cost-Analysis.md (Detailed cost breakdown - 52 KB)
│   ├── VaidyaVaani-Competitive-Analysis.md (Market analysis - 16 KB)
│   ├── Architectural-Diagrams/
│   │   ├── README-Diagrams.md (Diagram explanations)
│   │   ├── VaidyaVaani-Architecture.png (Complete system - 371 KB)
│   │   ├── VaidyaVaani-Nova-Sonic-Architecture.png (Optimized - 174 KB)
│   │   └── VaidyaVaani-Cost-Comparison.png (Visual breakdown - 140 KB)
│   └── Research-and-Discussion/
│       ├── README.md (Research guide + Final status)
│       ├── IVR-Doctor-24x7-Idea.md (Original idea)
│       ├── Global-Health-Tech-Success-Stories.md (Proven models)
│       ├── NHS-111-Technical-Deep-Dive.md (Technical blueprint)
│       └── VERIFICATION-REPORT.md (All claims verified)
├── PashuRaksha/ (Alternative idea - Livestock AI)
│   ├── README.md
│   ├── Livestock-AI-Deep-Analysis.md
│   └── Research-and-Discussion/
│       └── Livestock-AI-Triage-Idea.md
└── kiro chats/ (Development discussion history)
```

---

## 📋 Hackathon Submission Requirements

### Mandatory Deliverables

1. **GitHub Repository** (this repo)
   - `requirements.md` - Generated through Kiro
   - `design.md` - Generated through Kiro

2. **Presentation Deck**
   - PDF format only (max 5 MB)
   - Using official template provided by organizers

### 📅 Important Dates

- **Submission Start:** January 13, 2026, 5:00 PM IST
- **Submission Deadline:** February 15, 2026, 11:59 PM IST
- **Time Remaining:** ~33 days

### 🔗 Repository Details

- **GitHub URL:** https://github.com/subhash1208/SavyaSachi
- **SSH URL:** git@github.com:subhash1208/SavyaSachi.git
- **Contact:** m.subhash1208@gmail.com

---

## 🎯 VaidyaVaani Key Highlights

### The MOAT
350 million Indians have feature phones but no smartphone. VaidyaVaani is their ONLY option for AI-powered healthcare.

### Key Numbers
| Metric | Value |
|--------|-------|
| **Cost per call** | ₹42 (with Amazon Nova 2 Sonic) |
| **vs NHS 111** | 95% cheaper (₹950 → ₹42) |
| **vs Indian operators** | 63% cheaper (₹112 → ₹42) |
| **Target users** | 350M feature phone users |
| **Languages** | Hindi + English (native Indian accent - Arjun/Kiara voices) |
| **Code-switching** | Supports "Hinglish" (mixing Hindi + English naturally) |
| **Regional languages** | Tamil, Telugu, Bengali, etc. via Transcribe+Polly fallback |
| **Novelty score** | 9/10 (highly novel) |

### Technical Innovation
- **Amazon Nova 2 Sonic** (speech-to-speech AI) - Latest model with native Hindi support!
- **Indian-accented voices** (Arjun/Kiara) - Culturally appropriate for Indian users
- **Multimodal AI** (voice + vision via Claude Vision for photos)
- **Agentic capabilities** (AI takes actions, not just advice)
- **Feature phone compatible** (works on ₹1,500 phones)
- **No internet required** (IVR-based)

### Validation
- ✅ **Nandan Nilekani** (Aadhaar/UPI architect): "Voice AI is India's next UPI moment"
- ✅ **Bharat Vistaar**: ₹150 crore proves government wants this model
- ✅ **NHS 111**: 48K calls/day proves IVR triage works at scale
- ✅ **Babyl Rwanda**: 2M users proves AI health works
- ✅ **All claims verified**: 98/100 accuracy score

---

## 🏗️ Architecture Overview

### Original Architecture (₹67/call)
Amazon Connect → Transcribe (STT) → Bedrock (AI) → Polly (TTS) → Actions

### Optimized with Nova 2 Sonic (₹42/call)
Amazon Connect + Nova 2 Sonic (unified speech-to-speech with Indian voices) → Actions

**Cost Savings:** 37% reduction by replacing 3 services with 1

**Voice:** Arjun (Indian male) or Kiara (Indian female) - Native Hindi + English with Indian accent

### Key AWS Services
- Amazon Connect (IVR + Nova 2 Sonic with Arjun/Kiara voices)
- Amazon Bedrock (Claude 3.5 Sonnet + Knowledge Base)
- AWS Step Functions (Agentic orchestration)
- Amazon EventBridge (Event routing)
- AWS Lambda (Serverless compute)
- Amazon S3 (Storage)
- Amazon CloudWatch (Monitoring)

**Language Support:**
- **Tier 1 (Hindi + English):** Nova 2 Sonic with Indian accent (Arjun/Kiara) - Fast, cheap, native
- **Tier 2 (Regional):** Transcribe + Polly fallback for Tamil, Telugu, Bengali, Marathi, etc.

---

## 🚀 Innovation & Impact

### 6 Critical Enhancements (from gap analysis)
1. ✅ **Disease Surveillance & Outbreak Detection** - Public health intelligence
2. ✅ **WhatsApp Photo Path** - Multimodal AI for visual symptoms
3. ✅ **ASHA Worker Integration** - Connects to existing healthcare infrastructure
4. ✅ **Nandan Nilekani Validation** - Credibility from India's digital architect
5. ✅ **Chronic Disease Follow-Up** - Proactive care management
6. ✅ **Language Support Clarity** - Honest assessment of capabilities

### Social Impact
- **900 million rural Indians** - Primary beneficiaries
- **350 million feature phone users** - Exclusive access (no other AI option)
- **22,500 maternal deaths/year** - Preventable with early intervention
- **50,000+ snakebite deaths/year** - Rapid guidance saves lives

---

## 📊 Competitive Advantage

### Why VaidyaVaani Wins

**Existing Solutions:**
- ❌ eSanjeevani: Requires smartphone + internet + video
- ❌ 104 Helpline: Human operators, can't scale, limited hours
- ❌ Health apps: All require smartphones + literacy
- ❌ Bharat Vistaar: Agriculture only, not healthcare

**VaidyaVaani:**
- ✅ Works on ANY phone (feature phone, smartphone, landline)
- ✅ No internet required (IVR-based)
- ✅ No literacy required (voice-only)
- ✅ 24/7 availability (AI-powered)
- ✅ Scalable to millions (serverless architecture)
- ✅ 95% cheaper than NHS 111
- ✅ Agentic (takes actions: dispatch ambulance, send SMS, book appointments)

**Novelty Score:** 9/10 - Only IVR + AI + Feature Phone solution in India

---

## 💰 Cost Analysis

### Per-Call Economics
- **VaidyaVaani (Nova 2 Sonic):** ₹42/call
- **VaidyaVaani (Original):** ₹67/call
- **Indian human operators:** ₹112/call
- **NHS 111 (UK):** ₹950/call

### National Deployment (3 years)
- **Total Investment:** ₹63 crore
- **vs Bharat Vistaar:** 42% of budget (₹150 crore)
- **Break-even:** 161 calls/day
- **ROI (Year 3):** 3,955%

---

## 📚 Documentation

### Core Documentation (in VaidyaVaani/ folder)
1. **README.md** - Master overview & quick start guide
2. **VaidyaVaani-Final-Presentation.md** - Complete presentation (23 KB)
3. **VaidyaVaani-Cost-Analysis.md** - Deep cost breakdown (51 KB)
4. **VaidyaVaani-Competitive-Analysis.md** - Market analysis (14 KB)

### Research & Validation
- **Research-and-Discussion/** - 4 research files with verified data
- **VERIFICATION-REPORT.md** - All claims verified with sources
- **FINAL-STATUS.md** - Complete project status

### Architecture Diagrams
- **VaidyaVaani-Architecture.png** - Complete system (371 KB)
- **VaidyaVaani-Nova-Sonic-Architecture.png** - Optimized (174 KB)
- **VaidyaVaani-Cost-Comparison.png** - Visual cost breakdown (140 KB)

---

## 🛠️ Technology Stack

### AI & ML
- Amazon Bedrock (Claude 3.5 Sonnet)
- Amazon Nova 2 Sonic (Speech-to-speech with Hindi + English support)
- Amazon Bedrock Knowledge Base (Vector search)

### Voice & Communication
- Amazon Connect (IVR with Nova 2 Sonic)
- Arjun/Kiara voices (Indian accent, Hindi + English native)
- Amazon Transcribe (STT - fallback for regional languages)
- Amazon Polly (TTS - fallback for regional languages)

### Orchestration & Compute
- AWS Step Functions (Agentic workflows)
- AWS Lambda (Serverless functions)
- Amazon EventBridge (Event routing)

### Storage & Analytics
- Amazon S3 (Data storage)
- Amazon CloudWatch (Monitoring)
- Amazon QuickSight (Analytics)

### Integration
- Amazon SNS (SMS notifications)
- API Gateway (External integrations)
- ABDM integration (Health records)

---

## 🎯 Submission Checklist

### Before Submission
- [ ] Generate `requirements.md` using Kiro "Spec > Design"
- [ ] Generate `design.md` using Kiro "Spec > Design"
- [ ] Upload both files to this GitHub repo
- [ ] Download official PPT template
- [ ] Create presentation using template
- [ ] Convert presentation to PDF (max 5 MB)
- [ ] Verify GitHub repo is accessible
- [ ] Submit on portal before Feb 15, 2026 11:59 PM IST

### During Submission
- [ ] Select challenge/track
- [ ] Upload PDF presentation
- [ ] Enter GitHub URL: https://github.com/subhash1208/SavyaSachi
- [ ] Verify all fields are filled
- [ ] Click Submit

---

## 📞 Contact & Support

**Team:** SavyaSachi  
**Email:** m.subhash1208@gmail.com  
**GitHub:** https://github.com/subhash1208/SavyaSachi

**Hackathon Support:**  
- Hack2Skill: support@hack2skill.com
- Phone: +91 9870330830

---

## 📄 License

This project is submitted for the AI for Bharat 2026 Hackathon organized by Hack2Skill and AWS.

---

**Built with ❤️ for Bharat by Team SavyaSachi**

*"Voice AI is India's next UPI moment" - Nandan Nilekani*
