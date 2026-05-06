'use strict';

/**
 * Utilitaire OTP — LISSAFI-P
 *
 * Génère des codes OTP à 6 chiffres et les envoie par SMS.
 * En développement : affiche le code dans les logs (pas de vrai SMS).
 * En production    : envoie via Twilio ou Orange API Cameroun.
 */

const crypto = require('crypto');
const config = require('../config/env');
const logger = require('./logger');

// ---------------------------------------------------------------------------
// Générer un code OTP
// ---------------------------------------------------------------------------

/**
 * Génère un code OTP à 6 chiffres cryptographiquement sécurisé.
 * Utilise crypto.randomInt pour éviter les biais statistiques.
 *
 * @returns {string} Code OTP à 6 chiffres (ex: "047823")
 */
function generateOtp() {
  const code = crypto.randomInt(0, 999999);
  return code.toString().padStart(6, '0');
}

// ---------------------------------------------------------------------------
// Envoyer le code OTP par SMS
// ---------------------------------------------------------------------------

/**
 * Envoie un SMS contenant le code OTP au numéro donné.
 * Bascule automatiquement sur le mock en environnement de test/dev.
 *
 * @param {string} phone   - Numéro de téléphone au format international (+237...)
 * @param {string} otp     - Code OTP à 6 chiffres
 * @returns {Promise<{ success: boolean, provider: string, ref?: string }>}
 */
async function sendOtpSms(phone, otp) {
  const message = `[LISSAFI-P] Votre code de vérification est : ${otp}. Valable ${config.otp.expiresMinutes} minutes. Ne le partagez jamais.`;

  // En développement ou test : mock — pas de vrai SMS envoyé
  if (config.isDev || config.isTest) {
    logger.info('[OTP] MODE DEV — Code OTP généré (pas de SMS envoyé)', {
      phone,
      otp,
      message,
    });
    return { success: true, provider: 'mock', ref: 'dev-' + Date.now() };
  }

  // En production : essai Twilio puis Orange en fallback
  try {
    const result = await sendViaTwilio(phone, message);
    return result;
  } catch (twilioErr) {
    logger.warn('[OTP] Twilio échoué, tentative Orange API', { error: twilioErr.message });
    try {
      const result = await sendViaOrange(phone, message);
      return result;
    } catch (orangeErr) {
      logger.error('[OTP] Tous les providers SMS ont échoué', {
        twilio: twilioErr.message,
        orange: orangeErr.message,
      });
      throw new Error('Impossible d\'envoyer le SMS. Réessayez dans quelques instants.');
    }
  }
}

// ---------------------------------------------------------------------------
// Provider Twilio
// ---------------------------------------------------------------------------

async function sendViaTwilio(phone, message) {
  const twilio = require('twilio')(
    config.twilio.accountSid,
    config.twilio.authToken
  );

  const response = await twilio.messages.create({
    body: message,
    from: config.twilio.phoneNumber,
    to:   phone,
  });

  logger.info('[OTP] SMS envoyé via Twilio', { sid: response.sid, phone });
  return { success: true, provider: 'twilio', ref: response.sid };
}

// ---------------------------------------------------------------------------
// Provider Orange Money Cameroun
// ---------------------------------------------------------------------------

async function sendViaOrange(phone, message) {
  // TODO: intégrer l'API SMS d'Orange Cameroun
  // Documentation : https://developer.orange.com/apis/sms-cm/overview
  logger.warn('[OTP] Orange API SMS non encore implémentée');
  throw new Error('Orange API SMS non implémentée');
}

// ---------------------------------------------------------------------------
// Construire le message OTP
// ---------------------------------------------------------------------------

/**
 * Retourne le texte du message OTP formaté.
 * Utile pour l'envoyer aussi par e-mail si l'utilisateur n'a pas de téléphone.
 *
 * @param {string} otp
 * @returns {string}
 */
function buildOtpMessage(otp) {
  return `Votre code de vérification LISSAFI-P est : ${otp}\n\nCe code est valable ${config.otp.expiresMinutes} minutes.\nNe le partagez jamais avec quiconque.`;
}

module.exports = {
  generateOtp,
  sendOtpSms,
  buildOtpMessage,
};
