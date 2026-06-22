
  // ══════════════════════════════
  // TOAST
  // ══════════════════════════════
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }

  // ══════════════════════════════
  // STEPPER UPDATE
  // ══════════════════════════════
  function updateStepper(step) {
    for (let i = 1; i <= 3; i++) {
      const circle = document.getElementById('circle' + i);
      const label  = document.getElementById('label' + i);
      circle.classList.remove('active', 'done');
      label.classList.remove('active');

      if (i < step) {
        circle.classList.add('done');
        circle.innerHTML = '<i class="bi bi-check-lg"></i>';
      } else if (i === step) {
        circle.classList.add('active');
        circle.innerHTML = i;
        label.classList.add('active');
      } else {
        circle.innerHTML = i;
      }
    }
    // Lines
    if (step > 1) document.getElementById('line1').classList.add('done');
    else          document.getElementById('line1').classList.remove('done');
    if (step > 2) document.getElementById('line2').classList.add('done');
    else          document.getElementById('line2').classList.remove('done');
  }

  function showPanel(id) {
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  // ══════════════════════════════
  // STEP 1 → STEP 2
  // ══════════════════════════════
  function goToStep2() {
    const email    = document.getElementById('emailInput').value.trim();
    const emailErr = document.getElementById('emailErr');
    emailErr.classList.remove('show');

    if (!email) {
      emailErr.textContent = 'Email is required.';
      emailErr.classList.add('show');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      emailErr.textContent = 'Please enter a valid email address.';
      emailErr.classList.add('show');
      return;
    }

    // Loading
    const btn  = document.getElementById('sendCodeBtn');
    const sp   = document.getElementById('spinner1');
    const txt  = document.getElementById('sendBtnText');
    btn.disabled = true;
    sp.classList.add('show');
    txt.textContent = 'Sending...';

    setTimeout(() => {
      btn.disabled = false;
      sp.classList.remove('show');
      txt.textContent = 'Send Verification Code';

      // Update OTP description with email
      document.getElementById('otpDesc').textContent =
        'Enter the 4-digit code sent to ' + email;

      updateStepper(2);
      showPanel('panel2');
      showToast('Verification code sent! 📧');
      document.getElementById('otp1').focus();
    }, 1500);
  }

  // ══════════════════════════════
  // OTP AUTO JUMP
  // ══════════════════════════════
  ['otp1','otp2','otp3','otp4'].forEach(function(id, idx, arr) {
    document.getElementById(id).addEventListener('input', function() {
      this.value = this.value.replace(/[^0-9]/g, '');
      if (this.value && idx < arr.length - 1) {
        document.getElementById(arr[idx + 1]).focus();
      }
    });
    document.getElementById(id).addEventListener('keydown', function(e) {
      if (e.key === 'Backspace' && !this.value && idx > 0) {
        document.getElementById(arr[idx - 1]).focus();
      }
    });
  });

  // ══════════════════════════════
  // STEP 2 → STEP 3
  // ══════════════════════════════
  function goToStep3() {
    const otp = ['otp1','otp2','otp3','otp4']
      .map(id => document.getElementById(id).value).join('');
    const otpErr = document.getElementById('otpErr');
    otpErr.classList.remove('show');

    if (otp.length < 4) {
      otpErr.textContent = 'Please enter the complete 4-digit code.';
      otpErr.classList.add('show');
      return;
    }

    const sp  = document.getElementById('spinner2');
    const txt = document.getElementById('verifyBtnText');
    const btn = document.querySelector('#panel2 .btn-primary-custom');
    btn.disabled = true;
    sp.classList.add('show');
    txt.textContent = 'Verifying...';

    setTimeout(() => {
      btn.disabled = false;
      sp.classList.remove('show');
      txt.textContent = 'Verify Code';
      updateStepper(3);
      showPanel('panel3');
      showToast('Code verified! ✅');
    }, 1500);
  }

  // ══════════════════════════════
  // RESET PASSWORD
  // ══════════════════════════════
  function resetPassword() {
    const newPass     = document.getElementById('newPass').value;
    const confirmPass = document.getElementById('confirmPass').value;
    const newPassErr  = document.getElementById('newPassErr');
    const confErr     = document.getElementById('confirmPassErr');

    newPassErr.classList.remove('show');
    confErr.classList.remove('show');

    let valid = true;

    if (!newPass) {
      newPassErr.textContent = 'New password is required.';
      newPassErr.classList.add('show');
      valid = false;
    } else if (newPass.length < 6) {
      newPassErr.textContent = 'Password must be at least 6 characters.';
      newPassErr.classList.add('show');
      valid = false;
    }

    if (!confirmPass) {
      confErr.textContent = 'Please confirm your password.';
      confErr.classList.add('show');
      valid = false;
    } else if (newPass !== confirmPass) {
      confErr.textContent = 'Passwords do not match.';
      confErr.classList.add('show');
      valid = false;
    }

    if (!valid) return;

    const sp  = document.getElementById('spinner3');
    const txt = document.getElementById('resetBtnText');
    const btn = document.querySelector('#panel3 .btn-primary-custom');
    btn.disabled = true;
    sp.classList.add('show');
    txt.textContent = 'Resetting...';

    setTimeout(() => {
      sp.classList.remove('show');
      showToast('Password reset successfully! 🎉');
      showPanel('panelSuccess');
    }, 1800);
  }

  // ══════════════════════════════
  // BACK BUTTON
  // ══════════════════════════════
  function goToStepBack(step) {
    updateStepper(step);
    showPanel('panel' + step);
  }

  // ══════════════════════════════
  // TOGGLE PASSWORD VISIBILITY
  // ══════════════════════════════
  function togglePass(inputId, iconId) {
    const inp  = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    const show = inp.type === 'password';
    inp.type   = show ? 'text' : 'password';
    icon.className = show ? 'bi bi-eye-slash' : 'bi bi-eye';
  }

  // ══════════════════════════════
  // RESEND CODE
  // ══════════════════════════════
  function resendCode() {
    showToast('Verification code resent! 📧');
    ['otp1','otp2','otp3','otp4'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('otp1').focus();
  }
