import { Ionicons } from '@expo/vector-icons';

export function TabIcon({ name, color, size }: { name: any; color: string; size: number }) {
  return <Ionicons name={name} color={color} size={size} />;
}