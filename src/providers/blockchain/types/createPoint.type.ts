export type createPoint = {
  initialSupply: number;
  name: string;
  symbol: string;
  decimal: number;
  startDate?: number; // Unix timestamp วันเริ่มต้น (seconds) - optional
  endDate?: number; // Unix timestamp วันหมดอายุ (seconds) - กำหนดวันเอง
  expiryMonths?: number; // จำนวนเดือน (3, 6, 9, 12, 24) - เลือกระยะเวลา
  ownerAddress: string; // Merchant wallet address
};
