import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useEditionStore } from '../../lib/store'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { colors, fonts, fontSize, spacing } from '../../lib/theme'

interface Edition {
  id: string
  name: string
  season: string
  status: string
  league?: { name: string; format: string }
  _count?: { registrations: number }
}

export default function TorneosScreen() {
  const { editionId, setEdition } = useEditionStore()

  const { data: editions, isLoading, refetch } = useQuery({
    queryKey: ['editions'],
    queryFn: async () => {
      const { data } = await api.get('/editions')
      return data as Edition[]
    },
  })

  const selectEdition = (ed: Edition) => {
    setEdition(ed.id, ed.name)
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={editions ?? []}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.green.primary}
          />
        }
        renderItem={({ item }) => {
          const active = item.id === editionId
          return (
            <Pressable onPress={() => selectEdition(item)}>
              <Card glow={active} style={active ? styles.activeCard : undefined}>
                <View style={styles.row}>
                  <MaterialCommunityIcons
                    name="trophy"
                    size={24}
                    color={active ? colors.green.primary : colors.text.muted}
                  />
                  <View style={styles.info}>
                    <Text style={styles.editionName}>{item.name}</Text>
                    <Text style={styles.leagueName}>
                      {item.league?.name} — {item.season}
                    </Text>
                  </View>
                  <Badge
                    label={item.status === 'active' ? 'Activo' : item.status}
                    variant={item.status === 'active' ? 'success' : 'info'}
                  />
                </View>
                {active && (
                  <View style={styles.selectedRow}>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={14}
                      color={colors.green.primary}
                    />
                    <Text style={styles.selectedText}>Torneo seleccionado</Text>
                  </View>
                )}
              </Card>
            </Pressable>
          )
        }}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="trophy-broken" size={48} color={colors.text.muted} />
              <Text style={styles.emptyText}>No hay torneos disponibles</Text>
            </View>
          ) : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  list: {
    padding: spacing.md,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  info: { flex: 1 },
  editionName: {
    fontFamily: fonts.heading,
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
  leagueName: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },
  activeCard: {
    borderColor: colors.green.primary,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  selectedText: {
    fontFamily: fonts.label,
    fontSize: fontSize.xs,
    color: colors.green.primary,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: spacing.md,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: colors.text.muted,
  },
})
