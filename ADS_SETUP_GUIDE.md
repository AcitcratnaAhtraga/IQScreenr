# 📢 Ad Setup Guide for IQGuessr Extension

This guide explains how to add ads to your browser extension popup to monetize it.

## ✅ What's Already Done

I've added an ad section to your popup that appears before the footer. The ad container is ready and styled to match your extension's design.

## 🎯 Three Ad Options

You have **3 different ways** to monetize:

### Option 1: Google AdSense (Recommended for Passive Income)

**Pros:**
- Automatic ads, no maintenance
- Google handles everything
- Can earn $0.10 - $2+ per 1000 views (varies widely)
- Easy to set up

**Cons:**
- Requires approval from Google (can take days/weeks)
- Need a website/blog to get approved (they don't approve extensions alone)
- Lower earnings for small audiences

**How to Set Up:**

1. **Get AdSense Account:**
   - Go to https://www.google.com/adsense/
   - Sign up (you'll need a website/blog to get approved)
   - Once approved, you'll get a Publisher ID (looks like `ca-pub-1234567890`)

2. **Create an Ad Unit:**
   - In AdSense dashboard, go to "Ads" → "By ad unit"
   - Create a new "Display ad"
   - Choose "Responsive" format
   - Copy your Ad Slot ID (looks like `1234567890`)

3. **Add to Your Extension:**
   - Open `popup/popup.html`
   - Find the ad section (around line 326)
   - Uncomment the Google AdSense code (remove `<!--` and `-->`)
   - Replace `YOUR_PUBLISHER_ID` with your actual Publisher ID
   - Replace `YOUR_AD_SLOT_ID` with your Ad Slot ID
   - Uncomment the AdSense script at the bottom (line 371)

**Example:**
```html
<!-- Change this: -->
data-ad-client="ca-pub-YOUR_PUBLISHER_ID"
data-ad-slot="YOUR_AD_SLOT_ID"

<!-- To this: -->
data-ad-client="ca-pub-1234567890123456"
data-ad-slot="1234567890"
```

---

### Option 2: Custom Affiliate/Banner Ads (Best for Direct Deals)

**Pros:**
- Higher earnings per click (often $0.50 - $5+ per click)
- Full control over what's shown
- No approval needed
- Can promote your own products/services

**Cons:**
- Need to find sponsors/affiliate programs
- Manual setup for each ad
- Need to update ads yourself

**How to Set Up:**

1. **Find Affiliate Programs:**
   - Amazon Associates (amazon.com/associates)
   - ShareASale, CJ Affiliate, etc.
   - Direct sponsors (reach out to companies)
   - Your own products/services

2. **Get Affiliate Links:**
   - Sign up for affiliate programs
   - Get your unique affiliate links
   - Example: `https://example.com/product?ref=YOUR_ID`

3. **Update the Ad:**
   - Open `popup/popup.html`
   - Find the custom ad section (around line 340)
   - Replace `https://example.com/affiliate-link` with your affiliate link
   - Update the text to match what you're promoting

**Example:**
```html
<a href="https://amazon.com/product?tag=yourid-20" target="_blank" class="custom-ad-link">
  <div class="custom-ad">
    <div class="custom-ad-text">
      <strong>Check Out This Product</strong>
      <span>Support the extension!</span>
    </div>
  </div>
</a>
```

---

### Option 3: Simple Text Ad (Easiest to Start)

**Pros:**
- No approval needed
- Can promote anything
- Simple to set up
- Good for testing

**Cons:**
- Lower click rates
- Need to update manually
- Less professional looking

**How to Set Up:**

1. **Open `popup/popup.html`**
2. **Find the text ad section** (around line 350)
3. **Uncomment it** (remove `<!--` and `-->`)
4. **Comment out or remove the custom ad** (Option 2)
5. **Update the text and link** to what you want to promote

**Example:**
```html
<div class="text-ad">
  <p><strong>Premium IQ Analytics!</strong></p>
  <p>Get detailed insights and trends</p>
  <a href="https://your-website.com/premium" target="_blank" class="ad-button">Upgrade Now</a>
</div>
```

---

## 🎨 Customizing the Ad Appearance

The ads are styled in `popup/popup.css`. You can customize:

- **Colors:** Change the gradient in `.custom-ad` (line ~901)
- **Size:** Adjust `min-height` in `.ad-container` (line ~865)
- **Position:** Move the ad section in `popup.html` (currently before footer)

---

## 💰 How Much Can You Earn?

**AdSense:**
- Small extension (100 users): $1-10/month
- Medium (1,000 users): $10-50/month
- Large (10,000+ users): $50-500+/month

**Affiliate Ads:**
- Depends on commission (often 5-50% of sale)
- Example: $50 product with 10% commission = $5 per sale
- 10 sales/month = $50/month

**Text Ads (Direct Deals):**
- Negotiate with sponsors
- Often $50-500/month for banner placement

---

## ⚠️ Important Notes

1. **Don't inject ads into Twitter/X pages** - This violates their ToS and Chrome policies. Only show ads in your popup!

2. **Chrome Web Store Policy:**
   - Ads in popups are allowed ✅
   - Must be clearly labeled as "Advertisement" ✅ (already done)
   - Can't be deceptive or misleading ✅

3. **Privacy:**
   - If using AdSense, users' data may be collected by Google
   - Consider adding a privacy notice if needed

4. **Testing:**
   - Test your extension after adding ads
   - Make sure ads load properly
   - Check that links work correctly

---

## 🚀 Quick Start (Easiest)

If you want to start immediately without waiting for AdSense approval:

1. Open `popup/popup.html`
2. Find line 340 (the custom ad)
3. Replace the link with an affiliate link or your own product
4. Update the text
5. Test it!

That's it! The ad will show up in your popup.

---

## 📝 Need Help?

- **AdSense Help:** https://support.google.com/adsense
- **Chrome Extension Policies:** https://developer.chrome.com/docs/webstore/program-policies/
- **Affiliate Programs:** Search for "affiliate programs" in your niche

Good luck with monetizing your extension! 🎉

