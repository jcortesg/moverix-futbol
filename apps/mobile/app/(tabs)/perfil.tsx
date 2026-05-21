import { View, Text, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { signOut } from 'firebase/auth'
import { getAuth_safe } from '../../lib/useAuth'
import { useAuthStore, useEditionStore } from '../../lib/store'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { colors, fonts, fontSize, spacing, shadows } from '../../lib/theme'

interface StatRow {
  label: string
  value: string | number
  icon: keyof typeof MaterialCommunityIcons.glyphMap
  color: string
}

export default function PerfilScreen() {
  const user = useAuthStore((s) => s.user)
  const editionId = useEditionStore((s) => s.editionId)

  const { data: stats } = useQuery({
    queryKey: ['my-stats', editionId],
    queryFn: async () => {
      if (!editionId) return null
      const { data } = await api.get('/player-stats', { params: { editionId } })
      const all = data as any[]
      return all.find((s: any) => s.playerUid === user?.uid) ?? null
    },
    enabled: !!editionId && !!user,
  })

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que deseas salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: () => {
          useEditionStore.getState().clear()
          signOut(getAuth_safe())
        },
      },
    ])
  }

  const statRows: StatRow[] = stats
    ? [
        { label: 'Partidos', value: stats.matchesPlayed, icon: 'soccer-field', color: colors.stat.blue },
        { label: 'Goles', value: stats.goals, icon: 'soccer', color: colors.green.primary },
        { label: 'Asistencias', value: stats.assists, icon: 'shoe-cleat', color: colors.stat.purple },
        { label: 'Amarillas', value: stats.yellowCards, icon: 'card', color: colors.stat.orange },
        { label: 'Rojas', value: stats.redCards, icon: 'card', color: colors.result.loss },
      ]
    : []

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {/* Avatar + info */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account" size={48} color={colors.green.primary} />
          </View>
          <Text style={styles.name}>{user?.displayName || 'Jugador'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Stats */}
        {statRows.length > 0 && (
          <Card style={styles.statsCard}>
            <Text style={styles.statsTitle}>MIS ESTADÍSTICAS</Text>
            <View style={styles.statsGrid}>
              {statRows.map((s) => (
                <View key={s.label} style={styles.statItem}>
                  <MaterialCommunityIcons name={s.icon} size={20} color={s.color} />
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {!stats && editionId && (
          <Card style={styles.noStats}>
            <MaterialCommunityIcons name="chart-line" size={32} color={colors.text.muted} />
            <Text style={styles.noStatsText}>
              Aún no tienes estadísticas en este torneo
            </Text>
          </Card>
        )}

        <View style={{ flex: 1 }} />

        {/* Logout */}
        <Button
          title="Cerrar sesión"
          variant="outline"
          onPress={handleLogout}
          icon={<MaterialCommunityIcons name="logout" size={18} color={colors.green.primary} />}
          style={styles.logoutBtn}
        />
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  safe: { flex: 1, padding: spacing.lg },
  avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.green.dim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.glowSoft,
  },
  name: {
    fontFamily: fonts.heading,
    fontSize: fontSize.xl,
    color: colors.text.primary,
  },
  email: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  statsCard: { marginBottom: spacing.md },
  statsTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSize.xs,
    color: colors.text.muted,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontFamily: fonts.stats,
    fontSize: fontSize.lg,
  },
  statLabel: {
    fontFamily: fonts.label,
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },
  noStats: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  noStatsText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
  },
  logoutBtn: {
    marginBottom: spacing.md,
  },
})
