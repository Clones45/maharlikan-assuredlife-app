// components/BackButton.tsx
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { useRouter } from 'expo-router';

const BackButton: React.FC = () => {
  const router = useRouter();

  return (
    <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 12 }}>
      <Text style={{ color: '#1f6feb', fontWeight: '700' }}>← Back</Text>
    </TouchableOpacity>
  );
};

export default BackButton;
