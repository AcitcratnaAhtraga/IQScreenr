/**
 * Landing Page Script
 * Handles download and installation instructions
 */

document.addEventListener('DOMContentLoaded', () => {
  const downloadLink = document.getElementById('downloadLink');
  const mobileNotice = document.getElementById('mobileNotice');

  // Detect mobile devices
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                   (window.innerWidth <= 768 && window.matchMedia('(pointer: coarse)').matches);

  // Show mobile notice if on mobile device
  if (isMobile) {
    mobileNotice.style.display = 'block';
  }

  // Set up download link immediately
  downloadLink.href = 'IqScreenr.zip';
  downloadLink.download = 'IqScreenr.zip';
  
  // Ensure download link works properly
  downloadLink.addEventListener('click', (e) => {
    // Allow the download to proceed - don't prevent default
    // The browser will handle the download automatically
  });

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

  // Handle manual install link click
  const manualInstallLink = document.querySelector('.manual-install-link');
  if (manualInstallLink) {
    manualInstallLink.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

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

