export type Role = 'admin' | 'staff';

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  branch_id: string;
  created_at: string;
}

export interface Branch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  created_at: string;
}

export interface StockItem {
  id: string;
  imei: string;
  model: string;
  color?: string;
  spec?: string;
  price: number;
  added_date: string;
  added_by: string;
  branch_id: string;
  created_at: string;
  updated_at: string;
  // joined fields
  added_by_profile?: { full_name: string; username: string };
  branch?: { name: string };
}

export interface SaleRecord {
  id: string;
  imei: string;
  model: string;
  color?: string;
  spec?: string;
  price: number;
  added_date: string;
  added_by?: string;
  sold_by: string;
  sold_date: string;
  branch_id: string;
  created_at: string;
  updated_at: string;
  // joined fields
  sold_by_profile?: { full_name: string; username: string };
  added_by_profile?: { full_name: string; username: string };
  branch?: { name: string };
}
