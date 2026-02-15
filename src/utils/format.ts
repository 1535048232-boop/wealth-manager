export const formatCurrency = (amount: number): string => {
  const absAmount = Math.abs(amount);
  
  if (absAmount >= 100000000) {
    return `${(amount / 100000000).toFixed(2)}亿`;
  }
  if (absAmount >= 10000) {
    return `${(amount / 10000).toFixed(2)}万`;
  }
  
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatFullCurrency = (amount: number): string => {
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
