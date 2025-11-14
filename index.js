/**
 * Landing Page Script
 * Handles download and installation instructions
 */

document.addEventListener('DOMContentLoaded', () => {
  const installButton = document.getElementById('installButton');
  const installInstructions = document.getElementById('installInstructions');
  const downloadLink = document.getElementById('downloadLink');
  const mobileNotice = document.getElementById('mobileNotice');

  // Detect mobile devices
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                   (window.innerWidth <= 768 && window.matchMedia('(pointer: coarse)').matches);

  // Show mobile notice if on mobile device
  if (isMobile) {
    mobileNotice.style.display = 'block';
  }

  // Check if Chrome extension APIs are available (for future Chrome Web Store integration)
  const isChrome = typeof chrome !== 'undefined' && chrome.runtime;

  // Set up download link immediately
  downloadLink.href = 'IqScreenr.zip';
  downloadLink.download = 'IqScreenr.zip';
  
  // Ensure download link works properly
  downloadLink.addEventListener('click', (e) => {
    // Allow the download to proceed - don't prevent default
    // The browser will handle the download automatically
  });

  // Handle install button click
  installButton.addEventListener('click', () => {
    // Check if we can use Chrome Web Store inline installation
    // Note: Chrome removed inline installation in 2018, but we can still try
    // or redirect to Chrome Web Store if published
    
    // For now, show manual installation instructions
    if (installInstructions.style.display === 'none') {
      installInstructions.style.display = 'block';
      installInstructions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      // Update button text
      installButton.innerHTML = `
        <span class="button-icon">✓</span>
        <span class="button-text">Instructions Shown</span>
      `;
      installButton.style.background = '#10b981';
    } else {
      // Scroll to instructions if already shown
      installInstructions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  // Alternative: Try to detect if extension is already installed
  // This is a simple check - you can enhance it
  if (isChrome) {
    // Check if extension is installed (optional enhancement)
    // chrome.runtime.sendMessage('your-extension-id', {action: 'ping'}, (response) => {
    //   if (response) {
    //     installButton.textContent = 'Extension Installed ✓';
    //     installButton.disabled = true;
    //   }
    // });
  }

  // Smooth scroll for anchor links (only for links starting with #)
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    // Skip the download link
    if (anchor.id === 'downloadLink') return;
    
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        // Expand the section if it's collapsed
        if (target.classList.contains('collapsed')) {
          const toggle = target.querySelector('.legal-toggle');
          const content = target.querySelector('.legal-content');
          if (toggle && content) {
            target.classList.remove('collapsed');
            content.style.display = 'block';
          }
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Toggle legal sections when clicking the title
  document.querySelectorAll('.legal-toggle').forEach(toggle => {
    toggle.addEventListener('click', function() {
      const section = this.closest('.legal-section');
      const content = section.querySelector('.legal-content');
      
      if (section.classList.contains('collapsed')) {
        section.classList.remove('collapsed');
        content.style.display = 'block';
      } else {
        section.classList.add('collapsed');
        content.style.display = 'none';
      }
    });
  });
});

