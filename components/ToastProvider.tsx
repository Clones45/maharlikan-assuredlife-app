import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, Layout } from 'react-native-reanimated';
import { memorialColors, memorialFonts, memorialShadows, memorialBorderRadius } from '../constants/memorialTheme';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
    id: string;
    type: ToastType;
    title: string;
    message: string;
}

interface NotificationContextType {
    showToast: (type: ToastType, title: string, message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useToast() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const showToast = useCallback((type: ToastType, title: string, message: string) => {
        const id = Math.random().toString(36).substring(7);
        const newToast = { id, type, title, message };

        setToasts((prev) => [...prev, newToast]);

        // Auto dismiss
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <NotificationContext.Provider value={{ showToast }}>
            {children}
            <View style={styles.toastContainer} pointerEvents="box-none">
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
                ))}
            </View>
        </NotificationContext.Provider>
    );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
    const getColors = () => {
        switch (toast.type) {
            case 'success':
                return { bg: 'rgba(6, 53, 40, 0.95)', border: memorialColors.gold, icon: '✓', text: memorialColors.gold };
            case 'error':
                return { bg: 'rgba(60, 10, 10, 0.95)', border: '#ef4444', icon: '✕', text: '#fca5a5' };
            default:
                return { bg: 'rgba(255, 255, 255, 0.95)', border: memorialColors.primary, icon: 'ℹ', text: memorialColors.primary };
        }
    };

    const colors = getColors();

    return (
        <Animated.View
            entering={FadeInUp.springify().damping(15)}
            exiting={FadeOutUp}
            layout={Layout.springify()}
            style={[styles.toast, { backgroundColor: colors.bg, borderColor: colors.border }]}
        >
            <View style={styles.iconContainer}>
                <Text style={[styles.icon, { color: colors.text }]}>{colors.icon}</Text>
            </View>
            <View style={styles.contentContainer}>
                <Text style={[styles.title, { color: colors.text }]}>{toast.title}</Text>
                <Text style={styles.message}>{toast.message}</Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 20, // Adjusted for Status Bar
        left: 20,
        right: 20,
        zIndex: 10000,
        elevation: 100, // Critical for Android being over headers
        gap: 10,
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: memorialBorderRadius.xl,
        borderWidth: 1,
        ...memorialShadows.lg,
    },
    iconContainer: {
        marginRight: 12,
    },
    icon: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    contentContainer: {
        flex: 1,
    },
    title: {
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 2,
        fontFamily: 'serif',
    },
    message: {
        color: '#e2e8f0', // Slight off-white for readability on dark backgrounds
        fontSize: 14,
    },
});
