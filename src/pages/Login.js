import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMoon, FiSun, FiSmartphone, FiShield } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import FormField from '../components/FormField';
import {
  clearFieldError,
  validateForm,
  validators,
} from '../utils/validation';

const phoneSchema = {
  phone: [
    validators.required('Mobile number is required'),
    validators.phone('Enter a valid 10-digit mobile number'),
  ],
};

const otpSchema = {
  otp: [
    validators.required('OTP is required'),
    validators.otp('Enter a valid 6-digit OTP'),
  ],
};

export default function Login() {
  const { sendOtp, verifyOtp, isAuthenticated, loading } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSendOtp = async (e) => {
    e.preventDefault();
    const result = validateForm(phoneSchema, { phone });
    setErrors(result.errors);
    if (!result.valid) return;

    setSubmitting(true);
    try {
      const data = await sendOtp(phone);
      toast.success(data.devHint || data.message);
      setStep('otp');
      setErrors({});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const result = validateForm(otpSchema, { otp });
    setErrors(result.errors);
    if (!result.valid) return;

    setSubmitting(true);
    try {
      await verifyOtp(phone, otp);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <button
        type="button"
        className="icon-btn login-theme-toggle"
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {isDark ? <FiSun size={16} /> : <FiMoon size={16} />}
      </button>

      <motion.div
        className="login-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
      >
        <div className="login-brand">
          <span className="brand-mark large">OL</span>
          <h1>OneLead</h1>
          <p>Sign in with your mobile number</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'phone' ? (
            <motion.form
              key="phone"
              className="login-form"
              onSubmit={handleSendOtp}
              noValidate
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
            >
              <FormField label="Mobile number" error={errors.phone}>
                <div style={{ position: 'relative' }}>
                  <FiSmartphone
                    size={15}
                    style={{
                      position: 'absolute',
                      left: 11,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--muted)',
                    }}
                  />
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setErrors((prev) => clearFieldError(prev, 'phone'));
                    }}
                    placeholder="10-digit mobile"
                    className={errors.phone ? 'invalid' : ''}
                    style={{ paddingLeft: 34 }}
                  />
                </div>
              </FormField>
              <button className="btn primary full" type="submit" disabled={submitting}>
                {submitting ? 'Sending OTP...' : 'Send OTP'}
              </button>
              <p className="hint">OTP will be sent to your WhatsApp number.</p>
            </motion.form>
          ) : (
            <motion.form
              key="otp"
              className="login-form"
              onSubmit={handleVerifyOtp}
              noValidate
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
            >
              <FormField label="Mobile number">
                <input type="tel" value={phone} disabled />
              </FormField>
              <FormField label="Enter OTP" error={errors.otp}>
                <div style={{ position: 'relative' }}>
                  <FiShield
                    size={15}
                    style={{
                      position: 'absolute',
                      left: 11,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--muted)',
                    }}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value);
                      setErrors((prev) => clearFieldError(prev, 'otp'));
                    }}
                    placeholder="6-digit OTP"
                    maxLength={6}
                    className={errors.otp ? 'invalid' : ''}
                    style={{ paddingLeft: 34 }}
                  />
                </div>
              </FormField>
              <button className="btn primary full" type="submit" disabled={submitting}>
                {submitting ? 'Verifying...' : 'Verify & sign in'}
              </button>
              <button
                type="button"
                className="btn full"
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setErrors({});
                }}
              >
                Change number
              </button>
              <p className="hint">Check WhatsApp for your verification code.</p>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
