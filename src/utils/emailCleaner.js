/**
 * Email Content Cleaner
 * Handles removal of quoted text, signatures, and content sanitization
 */

// Patterns for quoted text detection
const QUOTED_TEXT_PATTERNS = [
  // "On ... wrote:" patterns (English)
  /^On .+wrote:$/im,
  /^On .+ at .+ wrote:$/im,
  // "Em ... escreveu:" patterns (Portuguese)
  /^Em .+escreveu:$/im,
  /^Em .+ às .+ escreveu:$/im,
  // "El ... escribió:" patterns (Spanish)
  /^El .+escribió:$/im,
  // Outlook-style headers
  /^From: .+$/im,
  /^De: .+$/im,
  /^Sent: .+$/im,
  /^Enviado: .+$/im,
  /^To: .+$/im,
  /^Para: .+$/im,
  /^Subject: .+$/im,
  /^Assunto: .+$/im,
  // Original message markers
  /^-{3,}\s*Original Message\s*-{3,}$/im,
  /^-{3,}\s*Mensagem Original\s*-{3,}$/im,
  /^_{10,}$/m,
  // Gmail forwarding header
  /^-{5,}\s*Forwarded message\s*-{5,}$/im,
  /^-{5,}\s*Mensagem encaminhada\s*-{5,}$/im,
];

// Patterns for signature detection
const SIGNATURE_PATTERNS = [
  // Standard signature delimiter
  /^--\s*$/m,
  /^-- $/m,
  // Mobile signatures
  /^Enviado do meu (iPhone|iPad|Android|Samsung|Xiaomi|Motorola)/im,
  /^Sent from my (iPhone|iPad|Android|Samsung|Galaxy)/im,
  /^Enviado desde mi (iPhone|iPad|Android)/im,
  /^Get Outlook for (iOS|Android)/im,
  /^Obter o Outlook para (iOS|Android)/im,
  // Closing phrases (Portuguese)
  /^Atenciosamente,?\s*$/im,
  /^Att\.?,?\s*$/im,
  /^Abraços?,?\s*$/im,
  /^Cordialmente,?\s*$/im,
  /^Grato,?\s*$/im,
  /^Obrigado,?\s*$/im,
  // Closing phrases (English)
  /^Best regards,?\s*$/im,
  /^Kind regards,?\s*$/im,
  /^Regards,?\s*$/im,
  /^Thanks,?\s*$/im,
  /^Thank you,?\s*$/im,
  /^Sincerely,?\s*$/im,
  /^Cheers,?\s*$/im,
  // Closing phrases (Spanish)
  /^Saludos,?\s*$/im,
  /^Atentamente,?\s*$/im,
  /^Gracias,?\s*$/im,
];

// Pattern for contact block in signature (phone, email, job title)
const CONTACT_BLOCK_PATTERN = /(?:(?:Tel|Phone|Fone|Cel|Mobile|Telefone)[.:]\s*[\d\s\-\(\)\+]+)|(?:[A-Za-z\s]+\s*[|]\s*[A-Za-z\s]+)|(?:www\.[a-zA-Z0-9.-]+)/i;

/**
 * Removes quoted text from email content
 * @param {string} content - Email content
 * @returns {string} - Content without quoted text
 */
export function removeQuotedText(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  let cleaned = content;

  // Remove lines starting with ">" (quoted replies)
  cleaned = cleaned
    .split('\n')
    .filter((line) => !line.trim().startsWith('>'))
    .join('\n');

  // Find and remove content after quote headers
  for (const pattern of QUOTED_TEXT_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) {
      const index = cleaned.indexOf(match[0]);
      if (index !== -1) {
        cleaned = cleaned.slice(0, index).trim();
      }
    }
  }

  // Remove horizontal rule dividers that often precede quotes
  cleaned = cleaned.replace(/\n_{20,}\n[\s\S]*$/g, '');
  cleaned = cleaned.replace(/\n-{20,}\n[\s\S]*$/g, '');

  return cleaned.trim();
}

/**
 * Removes email signature from content
 * @param {string} content - Email content
 * @returns {string} - Content without signature
 */
export function removeSignature(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  const lines = content.split('\n');
  let signatureStartIndex = -1;

  // Look for signature markers from the end
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];

    // Check for standard signature delimiter
    if (/^--\s*$/.test(line)) {
      signatureStartIndex = i;
      break;
    }

    // Check for signature patterns
    for (const pattern of SIGNATURE_PATTERNS) {
      if (pattern.test(line)) {
        signatureStartIndex = i;
        break;
      }
    }

    if (signatureStartIndex !== -1) break;

    // Check for contact block patterns (but only in last 10 lines)
    if (lines.length - i <= 10 && CONTACT_BLOCK_PATTERN.test(line)) {
      // Look backwards for a likely signature start
      for (let j = i; j >= Math.max(0, i - 5); j--) {
        const prevLine = lines[j].trim();
        // Empty line or short name-like line before contact info
        if (prevLine === '' || (prevLine.length < 40 && /^[A-Za-zÀ-ÿ\s]+$/.test(prevLine))) {
          signatureStartIndex = j;
          break;
        }
      }
      if (signatureStartIndex !== -1) break;
    }
  }

  if (signatureStartIndex !== -1 && signatureStartIndex > 0) {
    return lines.slice(0, signatureStartIndex).join('\n').trim();
  }

  return content.trim();
}

/**
 * Extracts the main content from an email, removing quotes and signature
 * @param {string} content - Raw email content
 * @returns {string} - Clean main content
 */
export function extractMainContent(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  let cleaned = content;

  // First remove quoted text
  cleaned = removeQuotedText(cleaned);

  // Then remove signature
  cleaned = removeSignature(cleaned);

  // Clean up extra whitespace
  cleaned = cleaned
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .replace(/[ \t]+$/gm, '') // Remove trailing spaces
    .trim();

  return cleaned;
}

/**
 * Sanitizes HTML content, removing potentially malicious elements
 * @param {string} html - HTML content
 * @returns {string} - Sanitized HTML
 */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let sanitized = html;

  // Remove script tags and content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags and content
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');

  // Remove javascript: URLs
  sanitized = sanitized.replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"');

  // Remove data: URLs (except images)
  sanitized = sanitized.replace(/src\s*=\s*["']?\s*data:(?!image)[^"'\s>]*/gi, 'src=""');

  // Remove iframe tags
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  // Remove object tags
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');

  // Remove embed tags
  sanitized = sanitized.replace(/<embed\b[^>]*>/gi, '');

  // Remove form tags
  sanitized = sanitized.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

  // Remove meta refresh
  sanitized = sanitized.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, '');

  return sanitized;
}

/**
 * Converts HTML email to plain text
 * @param {string} html - HTML content
 * @returns {string} - Plain text content
 */
export function htmlToPlainText(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let text = html;

  // Replace common block elements with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/tr>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');

  // Add bullet points for list items
  text = text.replace(/<li[^>]*>/gi, '• ');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Clean up whitespace
  text = text
    .replace(/[ \t]+/g, ' ') // Multiple spaces to single
    .replace(/\n[ \t]+/g, '\n') // Remove leading spaces on lines
    .replace(/[ \t]+\n/g, '\n') // Remove trailing spaces on lines
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .trim();

  return text;
}

/**
 * Decodes common HTML entities
 * @param {string} text - Text with HTML entities
 * @returns {string} - Decoded text
 */
function decodeHtmlEntities(text) {
  const entities = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&copy;': '\u00A9',
    '&reg;': '\u00AE',
    '&trade;': '\u2122',
    '&ndash;': '\u2013',
    '&mdash;': '\u2014',
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&ldquo;': '\u201C',
    '&rdquo;': '\u201D',
    '&bull;': '\u2022',
    '&hellip;': '\u2026',
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'gi'), char);
  }

  // Decode numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

  return decoded;
}

/**
 * Detects if content contains forwarded message
 * @param {string} content - Email content
 * @returns {boolean} - True if forwarded
 */
export function isForwardedEmail(content) {
  if (!content || typeof content !== 'string') {
    return false;
  }

  const forwardPatterns = [
    /---------- Forwarded message ----------/i,
    /---------- Mensagem encaminhada ----------/i,
    /----- Forwarded Message -----/i,
    /Begin forwarded message:/i,
    /Início da mensagem encaminhada:/i,
    /^Fwd:/im,
    /^Fw:/im,
    /^Enc:/im,
  ];

  return forwardPatterns.some((pattern) => pattern.test(content));
}

/**
 * Extracts the original forwarded email content
 * @param {string} content - Email content with forwarded message
 * @returns {Object} - { forwarderNote: string, originalEmail: string }
 */
export function extractForwardedContent(content) {
  if (!content || typeof content !== 'string') {
    return { forwarderNote: '', originalEmail: '' };
  }

  const forwardMarkers = [
    '---------- Forwarded message ----------',
    '---------- Mensagem encaminhada ----------',
    '----- Forwarded Message -----',
    'Begin forwarded message:',
    'Início da mensagem encaminhada:',
  ];

  for (const marker of forwardMarkers) {
    const index = content.indexOf(marker);
    if (index !== -1) {
      return {
        forwarderNote: content.slice(0, index).trim(),
        originalEmail: content.slice(index + marker.length).trim(),
      };
    }
  }

  return { forwarderNote: '', originalEmail: content };
}

export default {
  removeQuotedText,
  removeSignature,
  extractMainContent,
  sanitizeHtml,
  htmlToPlainText,
  isForwardedEmail,
  extractForwardedContent,
};
