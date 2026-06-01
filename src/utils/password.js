export const normalizeCustomerPassword = (password = '') => {
  const value = String(password);
  return value.length < 6 ? value.padEnd(6, '0') : value;
};
