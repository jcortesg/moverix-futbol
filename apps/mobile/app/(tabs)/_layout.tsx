import { Tabs } from 'expo-router'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#16A34A',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: { backgroundColor: '#1B2535', borderTopColor: '#ffffff15' },
        headerStyle: { backgroundColor: '#1B2535' },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="fixture" options={{ title: 'Fixture' }} />
      <Tabs.Screen name="tabla" options={{ title: 'Tabla' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  )
}
