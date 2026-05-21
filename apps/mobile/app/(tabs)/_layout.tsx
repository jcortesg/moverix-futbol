import { Tabs } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { colors, fonts } from '../../lib/theme'

const TAB_ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  index: 'home',
  torneos: 'trophy',
  equipo: 'shield-half-full',
  perfil: 'account-circle',
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons
            name={TAB_ICON[route.name] ?? 'circle'}
            size={size}
            color={color}
          />
        ),
        tabBarActiveTintColor: colors.green.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: {
          backgroundColor: colors.bg.secondary,
          borderTopColor: colors.border.subtle,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.label,
          fontSize: 11,
          letterSpacing: 1,
        },
        headerStyle: {
          backgroundColor: colors.bg.primary,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTitleStyle: {
          fontFamily: fonts.heading,
          color: colors.text.primary,
          fontSize: 20,
          letterSpacing: 1,
        },
        headerTintColor: colors.text.primary,
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', headerShown: false }} />
      <Tabs.Screen name="torneos" options={{ title: 'Torneos' }} />
      <Tabs.Screen name="equipo" options={{ title: 'Equipo' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  )
}
