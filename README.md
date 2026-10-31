# ⚡ Campus Pulse - WhatsApp & Event Notice Parser

A responsive, high-accuracy client-side web application that transforms chaotic WhatsApp group forwards, notice texts, and event flyers into clean, organized event cards categorized with Playing Card Suits and synchronized with your device clock.

![Campus Pulse Status](https://img.shields.io/badge/Status-GitHub_Pages_Ready-success?style=for-the-badge&logo=github)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3.4-38B2AC?style=for-the-badge&logo=tailwind-css)
![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-ES6+-F7DF1E?style=for-the-badge&logo=javascript)

---

## 🌟 Key Features

### 1. 🎴 Playing Card Suits & Dynamic Border Color Coding
Every event card is styled in a light, semi-transparent **Cornflower Blue** (`rgba(100, 149, 237, 0.35)`) with crisp solid borders and inner detail tints synced to your device's date:
- ♥ **Green Hearts:** Scheduled for **2+ Days Later** (`diffDays >= 2`)
- ♣ **Yellow Clubs:** Scheduled for **Tomorrow** (`diffDays === 1`)
- ♦ **Red Diamonds:** Scheduled for **Today** (`diffDays === 0`)
- ♠ **Black Spades:** Event **Is Over / Completed** (`diffDays < 0`)

### 2. 🟢 Green Plus & 🔴 Red Delete Floating Dock
- **Solid Green Plus Button:** Opens a menu to quickly create cards from **Text / WhatsApp Notice** or **Flyer / Image**.
- **Solid Red Delete Button:** 
  - **Click 1:** Enters Selection Mode and **automatically selects all Black Spades (♠ Is Over) cards by default**.
  - **Click 2:** Removes all selected cards in one click.

### 3. 🔍 High-Accuracy WhatsApp Parser
- Handles real-world college & tech community announcements (e.g., Hackathons, Buildathons, Meetups).
- Reliably extracts:
  - 🏷️ **Event Title:** Intelligently isolates event names (e.g. `8-Hour Buildathon`, `PromptWars × CSSS 2026`) while stripping chat hype.
  - 📍 **Venue / Location:** Direct detection for auditorium, halls, campuses, rooms, or online platforms.
  - ⏰ **Time Range:** Accurately extracts start and end times (e.g., `9:00 AM – 5:00 PM`) including en-dashes (`–`) and em-dashes.
  - 🗓️ **Date:** Recognizes relative words (*today*, *tomorrow*) and explicit formats (*31st October 2026*, *DD/MM/YYYY*, *Month Day*).
  - 📝 **Summary:** Captures the core essence of the announcement.

### 4. 🛠️ Productivity & Utilities
- **Add to Google Calendar:** 1-click URL generation with title, timings, venue, and summary pre-filled.
- **Copy Details:** Quick clipboard export to paste directly back into group chats.
- **Edit & Adjust:** Easily adjust any extracted field with a modal editor.
- **Local Persistence:** Data persists in your browser's `localStorage` across page reloads.

---

## 🚀 How to Run Locally

Simply double-click or open `index.html` in your browser. Zero setup, zero build steps, and zero dependencies required!

---

## 🌐 Deploy to GitHub Pages (Free Hosting)

1. Create a new public repository on [github.com/new](https://github.com/new) named `campus-pulse` (leave "Add a README" unchecked).
2. Open PowerShell in this project folder and run:

```powershell
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/campus-pulse.git
git branch -M main
git push -u origin main
```

3. Go to your repository on GitHub:
   - Click **Settings** $\to$ **Pages** (on the left menu).
   - Under **Build and deployment > Branch**, select `main` and `/ (root)`.
   - Click **Save**.
4. Your website will be live at `https://<YOUR_GITHUB_USERNAME>.github.io/campus-pulse/`!
