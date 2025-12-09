import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate, Extrapolate } from 'react-native-reanimated';
import { memorialColors, memorialFonts, memorialShadows, memorialBorderRadius } from '../constants/memorialTheme';
import { TabIcon } from './TabIcon';

const { width } = Dimensions.get('window');

const TAB_BAR_HEIGHT = 70;
const TAB_BAR_MARGIN = 20;

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    // Hide tab bar on specific screens if needed
    const focusedOptions = descriptors[state.routes[state.index].key].options;
    if ((focusedOptions.tabBarStyle as any)?.display === 'none') {
        return null;
    }

    // Only show these specific tabs
    const allowedRoutes = ['members', 'promotions', 'profile', 'commission', 'AddMemberScreen'];

    return (
        <View style={styles.container}>
            <View style={styles.glassContainer}>
                {state.routes
                    .filter(route => allowedRoutes.includes(route.name))
                    .map((route) => {
                        const { options } = descriptors[route.key];

                        // Find the actual index of this route in the original state to check focus
                        const realIndex = state.routes.findIndex(r => r.key === route.key);
                        const isFocused = state.index === realIndex;

                        const onPress = () => {
                            const event = navigation.emit({
                                type: 'tabPress',
                                target: route.key,
                                canPreventDefault: true,
                            });

                            if (!isFocused && !event.defaultPrevented) {
                                navigation.navigate(route.name);
                            }
                        };

                        const onLongPress = () => {
                            navigation.emit({
                                type: 'tabLongPress',
                                target: route.key,
                            });
                        };

                        return (
                            <TabItem
                                key={route.key}
                                isFocused={isFocused}
                                onPress={onPress}
                                onLongPress={onLongPress}
                                options={options}
                                routeName={route.name}
                            />
                        );
                    })}
            </View>
        </View>
    );
}

function TabItem({ isFocused, onPress, onLongPress, options, routeName }: any) {
    const scale = useSharedValue(0);
    const translateY = useSharedValue(0);

    useEffect(() => {
        if (isFocused) {
            scale.value = withSpring(1, { damping: 12 });
            translateY.value = withSpring(-5, { damping: 12 });
        } else {
            scale.value = withTiming(0, { duration: 200 });
            translateY.value = withSpring(0, { damping: 12 });
        }
    }, [isFocused]);

    const animatedIconStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { scale: interpolate(scale.value, [0, 1], [1, 1.2]) },
                { translateY: translateY.value }
            ]
        };
    });

    const animatedTextStyle = useAnimatedStyle(() => {
        return {
            opacity: interpolate(scale.value, [0, 1], [0.7, 1]),
            transform: [
                { scale: interpolate(scale.value, [0, 1], [0.9, 1]) }
            ]
        };
    });

    // Decide icon based on route name (fallback if icon function not provided, though it usually is)
    // We use the same TabIcon component but control its props
    let iconName: any = 'square';
    if (routeName === 'members') iconName = 'people-outline';
    else if (routeName === 'promotions') iconName = 'leaf-outline';
    else if (routeName === 'profile') iconName = 'person-outline';
    else if (routeName === 'commission') iconName = 'wallet-outline';
    else if (routeName === 'AddMemberScreen') iconName = 'person-add-outline';

    const label = options.title !== undefined ? options.title : options.tabBarLabel !== undefined ? options.tabBarLabel : routeName;

    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabItem}
            activeOpacity={0.7}
        >
            <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
                {/* Glow effect behind active icon */}
                {isFocused && <View style={styles.activeGlow} />}

                <TabIcon
                    name={iconName}
                    color={isFocused ? memorialColors.gold : memorialColors.white}
                    size={24}
                />
            </Animated.View>

            <Animated.Text style={[styles.label, animatedTextStyle, { color: isFocused ? memorialColors.gold : 'rgba(255,255,255,0.6)' }]}>
                {label}
            </Animated.Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        alignItems: 'center',
        paddingBottom: Platform.OS === 'ios' ? 20 : 10,
        backgroundColor: 'transparent',
    },
    glassContainer: {
        flexDirection: 'row',
        width: width - (TAB_BAR_MARGIN * 2),
        height: TAB_BAR_HEIGHT,
        backgroundColor: 'rgba(6, 53, 40, 0.92)', // Deep emerald with transparency
        borderRadius: memorialBorderRadius.xxl,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        ...memorialShadows.xl,
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        width: 40,
        height: 40,
    },
    activeGlow: {
        position: 'absolute',
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(212, 175, 55, 0.15)', // Gold glow
    },
    label: {
        fontSize: 10,
        fontFamily: Platform.OS === 'ios' ? 'serif' : 'serif', // Ensure serif font usage
        fontWeight: '600',
    }
});
