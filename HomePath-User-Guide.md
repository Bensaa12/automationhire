# HomePath — Mortgage Manager
## User Guide

**Version:** Full Version (Pro)
**Works in:** Any browser — Chrome, Firefox, Safari, Edge
**Internet required:** No — runs 100% offline
**Your data:** Stays on your device. Nothing is sent anywhere.

---

## Getting Started

1. Open the `HomePath-MortgageManager.html` file in any browser
2. You will see five tabs along the top: **Overview**, **Costs**, **Maintenance**, **Amortization**, and **Report**
3. Start with the **Overview** tab and enter your mortgage details — everything else updates automatically

Your data is saved automatically in your browser. It will still be there the next time you open the file on the same device.

> **Tip:** Bookmark the file or pin it to your browser for quick access each month.

---

## Tab 1 — Overview

This is your mortgage dashboard. Enter your details once and the app tracks everything from here.

### What to fill in

| Field | What to enter |
|---|---|
| **Property Value** | Current estimated value of your home |
| **Outstanding Balance** | What you currently owe on your mortgage |
| **Monthly Payment** | Your monthly mortgage payment amount |
| **Interest Rate** | Your current interest rate (e.g. 4.5) |
| **Remaining Term** | How many years are left on your mortgage |
| **Deal Expiry Date** | When your current fixed or tracker deal ends |

### What the app calculates

- **Loan-to-Value (LTV)** — your balance as a percentage of your property value
- **LTV Band** — shows whether you are above or below the key thresholds: 90%, 85%, 80%, 75%, 70%, 60%
- **Equity** — how much of your home you own outright
- **Total Interest Remaining** — the total you will pay in interest over the rest of your term
- **Monthly Payment Breakdown** — how much of each payment is interest vs capital

### Deal expiry colour coding

| Colour | Meaning |
|---|---|
| 🟢 Green | More than 90 days remaining |
| 🟡 Amber | 90 days or fewer — time to start comparing deals |
| 🔴 Red | Deal has expired — you may be on your lender's Standard Variable Rate (SVR) |

> **Why this matters:** SVR rates are typically 2–3% higher than fixed deals. One month on an SVR can cost more than the price of this app.

---

## Tab 2 — Monthly Costs

See the true cost of owning your home — not just the mortgage.

### How to use it

Add each regular cost using the input fields:

- **Mortgage** — auto-filled from your Overview details
- **Council Tax** — your monthly council tax amount
- **Buildings Insurance** — monthly premium
- **Contents Insurance** — monthly premium
- **Life / Mortgage Insurance** — monthly premium
- **Gas & Electricity** — monthly average
- **Water** — monthly bill
- **Broadband & Phone** — monthly cost
- **Maintenance Reserve** — recommended: 1% of property value per year, divided by 12
- **Other** — any other regular home costs

### What you get

- **Total Monthly Cost** — the real number, everything included
- **Annual Total** — useful for budgeting and tax purposes
- A clear breakdown of where your money goes

> **Example:** A £250,000 home with a £1,100 mortgage might have a true monthly cost of £1,650 once all costs are included. Most homeowners significantly underestimate this figure.

---

## Tab 3 — Maintenance Tracker

Log every item in your home with its warranty, service schedule, and repair history.

### Adding an item

Click **Add Item** and fill in:

| Field | Example |
|---|---|
| **Item Name** | Boiler |
| **Category** | Heating |
| **Install / Purchase Date** | 15 March 2021 |
| **Warranty Expiry** | 15 March 2026 |
| **Next Service Due** | 15 October 2024 |
| **Notes** | Annual gas safety certificate due same time |

### What to track

Common items to log:

- Boiler and central heating system
- Roof (last inspection date)
- Electrical system (last EICR certificate)
- Plumbing (stopcock location, last check)
- Windows and doors
- White goods (washing machine, fridge, dishwasher)
- Flooring
- Damp proofing
- Smoke and CO alarms

### Adding repair costs

For each item you can log individual repairs:

1. Click on the item
2. Select **Add Cost**
3. Enter the date, description, and amount

This builds a complete repair history — useful for insurance claims, selling your home, and tracking which items cost the most over time.

### Status indicators

| Status | Meaning |
|---|---|
| 🟢 OK | Warranty valid, service not due |
| 🟡 Due Soon | Service due within 30 days |
| 🔴 Overdue | Service overdue or warranty expired |

---

## Tab 4 — Amortization Schedule

See every single monthly payment broken down for the life of your mortgage.

### What it shows

For each month you can see:

- **Payment number**
- **Opening balance**
- **Interest charged** that month
- **Capital repaid** that month
- **Closing balance**

### Overpayment simulator

At the top of this tab, enter a monthly overpayment amount to see:

- **Months saved** — how much earlier you will pay off your mortgage
- **Interest saved** — the total interest you will avoid paying
- **New payoff date**

> **Example:** Overpaying £200 per month on a £200,000 mortgage at 4.5% with 20 years remaining saves approximately £18,400 in interest and cuts 4 years off the term.

### How to use this for decisions

- Try different overpayment amounts to find the sweet spot for your budget
- Compare the interest saved against other uses of that money (ISA, pension top-up)
- Use the schedule to see how quickly you will cross the next LTV band

---

## Tab 5 — Report

Generate a clean, printable PDF summary of your home finances.

### What is included

- Your mortgage overview (balance, LTV, equity, deal expiry)
- Monthly costs summary
- Maintenance items due for attention
- Key figures from your amortization schedule
- Date and period covered

### How to generate

1. Click **Generate Monthly Report**
2. A print-ready page opens in a new tab
3. Press **Ctrl + P** (Windows) or **Cmd + P** (Mac)
4. Set destination to **Save as PDF**
5. Save it anywhere on your device

### Suggested routine

Run this report on the **first of each month** and save it to a folder named by year. This gives you a complete financial record of your home over time — useful for remortgaging, selling, or tax purposes.

---

## Your Data

### Where it is stored

All data is saved in your browser's local storage under the prefix `mm_`. It stays on your device and is never sent to any server.

### Backing up your data

1. Go to the **Overview** tab
2. Click **Export Data**
3. A JSON file will be saved to your downloads folder

Keep this backup in a safe place (cloud storage, external drive). If you clear your browser data or move to a new device, you will need this file to restore your information.

### Restoring from a backup

1. Open HomePath
2. Go to **Overview**
3. Click **Import Data**
4. Select your saved JSON backup file

### Moving to a new device

1. Export your data on the old device
2. Copy both the `HomePath-MortgageManager.html` file and the JSON backup to your new device
3. Open the HTML file in a browser
4. Import the JSON backup

---

## Tips for Getting the Most from HomePath

**Update once a month**
Spend 5 minutes at the start of each month updating your balance, checking the maintenance log, and running the report. The whole picture in under 5 minutes.

**Set a deal expiry reminder**
As soon as you take out a new mortgage deal, enter the expiry date. Start comparing new deals 3 months before expiry to avoid falling onto the SVR.

**Use the maintenance log before you sell**
A complete service history for your home is a genuine selling point and can support your asking price. Estate agents and buyers respond well to documented maintenance records.

**Track your LTV progress**
Each time you make a mortgage payment, your LTV drops slightly. When you cross a new band (80%, 75%, 70%), speak to a mortgage broker — you may be entitled to a significantly better rate.

**Overpay when you can**
Even small overpayments compound significantly over a 25-year mortgage. Use the simulator to see exactly what an extra £50 or £100 per month would do.

---

## Support

Having trouble or have a question?

**Email:** bensaa123@gmail.com

We respond to all queries promptly.

**Try the free version:** automationhire.co.uk/mortgage-manager

---

*HomePath — Mortgage Manager is a single-file offline application. No data ever leaves your device.*
*&copy; 2025 AutomationHire*
