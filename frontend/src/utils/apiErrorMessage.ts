/** First error message of a failed request ({ data: { errors: [...] } }), if any. */
export const apiErrorMessage = (error: unknown): string | undefined => {
  const errors = (error as { data?: { errors?: unknown } } | undefined)?.data?.errors;
  return Array.isArray(errors) && typeof errors[0] === 'string' ? errors[0] : undefined;
};
