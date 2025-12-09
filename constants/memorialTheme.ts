// Luxurious Mortuary Design System
// Premium green, black, white palette with gold accents
// Optimized for mobile phones and tablets

export const memorialColors = {
    // Primary - Luxurious Emerald Green
    primary: '#0A4D3C',           // Deep emerald - main brand
    primaryLight: '#0F6B52',      // Jade - interactive elements
    primaryDark: '#063528',       // Rich forest - headers, dark accents
    primaryHover: '#1A8B6B',      // Mint accent - hover states

    // Black - Sophisticated Depth
    black: '#000000',             // Pure black - primary text
    charcoal: '#1A1A1A',          // Card backgrounds (premium)
    graphite: '#2D2D2D',          // Secondary backgrounds
    smoke: '#4A4A4A',             // Muted text

    // White - Pristine Clarity
    white: '#FFFFFF',             // Pure white - primary backgrounds
    pearl: '#F8F9FA',             // Secondary backgrounds
    ivory: '#F5F5F5',             // Subtle backgrounds
    silver: '#E8E8E8',            // Borders, dividers

    // Gold - Premium Accents
    gold: '#D4AF37',              // Champagne gold - badges, highlights
    goldLight: '#E8D7A0',         // Soft gold - subtle accents
    goldDark: '#B8941F',          // Deep gold - premium elements

    // Semantic Colors (Luxurious variants)
    success: '#0F6B52',           // Jade green
    successLight: '#E8F5F1',
    warning: '#D4AF37',           // Gold
    warningLight: '#FAF6E8',
    error: '#8B3A3A',             // Deep burgundy
    errorLight: '#F5E8E8',
    info: '#2D5A6B',              // Deep teal
    infoLight: '#E8F1F5',

    // Gradients (for premium backgrounds)
    gradientPrimary: ['#063528', '#0A4D3C', '#0F6B52'],
    gradientGold: ['#B8941F', '#D4AF37', '#E8D7A0'],
    gradientDark: ['#000000', '#1A1A1A', '#2D2D2D'],

    // Glassmorphism
    glassWhite: 'rgba(255, 255, 255, 0.85)',
    glassBlack: 'rgba(26, 26, 26, 0.85)',
    glassGreen: 'rgba(10, 77, 60, 0.85)',

    // Overlays
    overlay: 'rgba(0, 0, 0, 0.4)',
    overlayLight: 'rgba(0, 0, 0, 0.2)',
    overlayDark: 'rgba(0, 0, 0, 0.7)',

    // Borders
    border: '#E8E8E8',
    borderDark: '#2D2D2D',
    borderGold: '#D4AF37',

    // Backgrounds
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F8F9FA',
    bgTertiary: '#F5F5F5',
    bgDark: '#1A1A1A',

    // Text
    textPrimary: '#000000',
    textSecondary: '#4A4A4A',
    textMuted: '#8A8A8A',
    textInverse: '#FFFFFF',
    textGold: '#D4AF37',

    // Backward compatibility aliases (for existing code)
    bgCard: '#FFFFFF',           // Maps to white
    cream: '#F8F9FA',            // Maps to pearl
    softWhite: '#FFFFFF',        // Maps to white
    paleGold: '#E8D7A0',         // Maps to goldLight
    borderLight: '#E8E8E8',      // Maps to silver
    accent: '#0F6B52',           // Maps to primaryLight
    accentLight: '#1A8B6B',      // Maps to primaryHover
};

export const memorialSpacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 40,
    massive: 48,
    // Navigation spacing
    tabBarHeight: 120,
};

export const memorialBorderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    round: 999,
};

export const memorialFonts = {
    // Font sizes (optimized for mobile phones and tablets)
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 22,
    xxxl: 28,
    display: 32,

    // Font weights
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    black: '900' as const,

    // Line heights (for readability)
    lineHeight: {
        tight: 1.2,
        normal: 1.5,
        relaxed: 1.75,
        loose: 2,
    },

    // Letter spacing (for luxury feel - reduced for mobile)
    letterSpacing: {
        tight: -0.3,
        normal: 0,
        wide: 0.3,
        wider: 0.6,
        widest: 1,
    },
};

export const memorialShadows = {
    // Premium shadows - deeper, more dramatic
    sm: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    md: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 16,
        elevation: 8,
    },
    xl: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 12,
    },
    // Gold glow for premium elements
    gold: {
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    // Green glow for interactive elements
    green: {
        shadowColor: '#0F6B52',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
};

export const memorialAnimations = {
    // Timing functions
    duration: {
        fast: 150,
        normal: 250,
        slow: 350,
        slower: 500,
    },

    // Easing curves
    easing: {
        easeIn: 'ease-in',
        easeOut: 'ease-out',
        easeInOut: 'ease-in-out',
        spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },

    // Scale values for interactions
    scale: {
        press: 0.97,
        hover: 1.02,
        active: 0.95,
    },
};

// Glassmorphism effect helper
export const glassmorphism = {
    light: {
        backgroundColor: memorialColors.glassWhite,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        // Note: backdrop-filter not supported in RN, use semi-transparent bg
    },
    dark: {
        backgroundColor: memorialColors.glassBlack,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    green: {
        backgroundColor: memorialColors.glassGreen,
        borderWidth: 1,
        borderColor: 'rgba(15, 107, 82, 0.3)',
    },
};

// Reusable component styles (Premium Edition)
export const memorialComponents = {
    card: {
        premium: {
            backgroundColor: memorialColors.white,
            borderRadius: memorialBorderRadius.lg,
            padding: memorialSpacing.xl,
            ...memorialShadows.lg,
            borderWidth: 1,
            borderColor: memorialColors.silver,
        },
        glass: {
            backgroundColor: memorialColors.glassWhite,
            borderRadius: memorialBorderRadius.lg,
            padding: memorialSpacing.xl,
            ...memorialShadows.md,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.3)',
        },
        gold: {
            backgroundColor: memorialColors.white,
            borderRadius: memorialBorderRadius.lg,
            padding: memorialSpacing.xl,
            ...memorialShadows.gold,
            borderWidth: 2,
            borderColor: memorialColors.gold,
        },
    },

    button: {
        primary: {
            backgroundColor: memorialColors.primary,
            borderRadius: memorialBorderRadius.md,
            paddingVertical: memorialSpacing.lg,
            paddingHorizontal: memorialSpacing.xxl,
            ...memorialShadows.md,
        },
        gold: {
            backgroundColor: memorialColors.gold,
            borderRadius: memorialBorderRadius.md,
            paddingVertical: memorialSpacing.lg,
            paddingHorizontal: memorialSpacing.xxl,
            ...memorialShadows.gold,
        },
        outline: {
            backgroundColor: 'transparent',
            borderRadius: memorialBorderRadius.md,
            paddingVertical: memorialSpacing.lg,
            paddingHorizontal: memorialSpacing.xxl,
            borderWidth: 2,
            borderColor: memorialColors.primary,
        },
        text: {
            primary: {
                color: memorialColors.white,
                fontSize: memorialFonts.md,
                fontWeight: memorialFonts.semibold,
                letterSpacing: memorialFonts.letterSpacing.wide,
            },
            gold: {
                color: memorialColors.black,
                fontSize: memorialFonts.md,
                fontWeight: memorialFonts.bold,
                letterSpacing: memorialFonts.letterSpacing.wide,
            },
        },
    },

    input: {
        backgroundColor: memorialColors.white,
        borderRadius: memorialBorderRadius.md,
        borderWidth: 2,
        borderColor: memorialColors.silver,
        paddingVertical: memorialSpacing.lg,
        paddingHorizontal: memorialSpacing.lg,
        fontSize: memorialFonts.md,
        color: memorialColors.black,
        ...memorialShadows.sm,
    },

    header: {
        gradient: {
            // Will use LinearGradient component
            colors: memorialColors.gradientPrimary,
            padding: memorialSpacing.xxl,
        },
        solid: {
            backgroundColor: memorialColors.primary,
            padding: memorialSpacing.xxl,
        },
    },
};

export default {
    colors: memorialColors,
    spacing: memorialSpacing,
    borderRadius: memorialBorderRadius,
    fonts: memorialFonts,
    shadows: memorialShadows,
    animations: memorialAnimations,
    glassmorphism,
    components: memorialComponents,
};
