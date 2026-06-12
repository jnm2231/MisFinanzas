import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type SelectOption = {
  id: number | string;
  label: string;
  sublabel?: string;
};

type Props = {
  placeholder: string;
  options: SelectOption[];
  selectedId: number | string | null;
  onSelect: (id: number | string) => void;
};

/** Campo desplegable: muestra la opción elegida y abre un modal con la lista. */
export function SelectModal({ placeholder, options, selectedId, onSelect }: Props) {
  const palette = Colors[useColorScheme() ?? 'light'];
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.id === selectedId);

  return (
    <>
      <Pressable
        style={[styles.field, { backgroundColor: palette.card, borderColor: palette.border }]}
        onPress={() => setOpen(true)}>
        <Text
          style={[styles.fieldText, { color: selected ? palette.text : palette.muted }]}
          numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color={palette.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <Text style={[styles.sheetTitle, { color: palette.muted }]}>{placeholder}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.id)}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: palette.muted }]}>No hay opciones</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.option, { borderBottomColor: palette.border }]}
                  onPress={() => {
                    onSelect(item.id);
                    setOpen(false);
                  }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionText, { color: palette.text }]}>{item.label}</Text>
                    {item.sublabel ? (
                      <Text style={[styles.optionSub, { color: palette.muted }]}>
                        {item.sublabel}
                      </Text>
                    ) : null}
                  </View>
                  {item.id === selectedId ? (
                    <MaterialCommunityIcons name="check" size={20} color={palette.tint} />
                  ) : null}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fieldText: {
    fontSize: 16,
    flex: 1,
    marginRight: 8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    borderRadius: 14,
    borderWidth: 1,
    maxHeight: '70%',
    paddingVertical: 8,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    fontSize: 16,
  },
  optionSub: {
    fontSize: 13,
    marginTop: 2,
  },
  empty: {
    textAlign: 'center',
    padding: 24,
    fontSize: 15,
  },
});
