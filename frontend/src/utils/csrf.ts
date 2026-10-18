/**
 * Get the CSRF token from Rails meta tags
 * Rails automatically includes these tags when you use csrf_meta_tags in your layout
 */
export const getCsrfToken = (): string => {
  const metaTag = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
  if (!metaTag) {
    console.warn('CSRF token meta tag not found. Make sure your Rails layout includes csrf_meta_tags');
    return '';
  }
  return metaTag.content;
};

/**
 * Get the CSRF param name (usually 'authenticity_token')
 */
export const getCsrfParam = (): string => {
  const metaTag = document.querySelector<HTMLMetaElement>('meta[name="csrf-param"]');
  if (!metaTag) {
    return 'authenticity_token';
  }
  return metaTag.content;
};
/**
 * Update the CSRF token stored in the Rails meta tag (e.g. after the session
 * changed and the server issued a new token).
 */
export const setCsrfToken = (token: string): void => {
  const metaTag = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
  if (metaTag) {
    metaTag.content = token;
  }
};
