import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { type Account, type Category } from '@/db/database';
import { addTransaction, getBaseAccount, getCategories } from '@/db/queries';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCurrency, parseAmount } from '@/lib/format';

export default function AgregarScreen() {
  const db = useSQLiteContext();
  const palette = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();

  const [baseAccount, setBaseAccount] = useState<Account | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);

  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState<number | null>(null);
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeCategoryId, setIncomeCategoryId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setBaseAccount(await getBaseAccount(db));
    setExpenseCategories(await getCategories(db, 'gasto'));
    setIncomeCategories(await getCategories(db, 'ingreso'));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const showFeedback = (message: string) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback(message);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2500);
  };

  const handleAdd = async (type: 'gasto' | 'ingreso') => {
    const amountText = type === 'gasto' ? expenseAmount : incomeAmount;
    const categoryId = type === 'gasto' ? expenseCategoryId : incomeCategoryId;

    const amount = parseAmount(amountText);
    if (amount === null) {
      Alert.alert('Cantidad no válida', 'Introduce una cantidad mayor que 0.');
      return;
    }
    if (categoryId === null) {
      Alert.alert(
        type === 'gasto' ? 'Falta la categoría' : 'Falta el tipo de ingreso',
        'Selecciona una opción de la lista.'
      );
      return;
    }

    const ok = await addTransaction(db, type, amount, categoryId);
    if (!ok) {
      Alert.alert('Sin Cuenta Base', 'Configura la Cuenta Base en la pestaña Ajustes.');
      return;
    }

    if (type === 'gasto') {
      setExpenseAmount('');
    } else {
      setIncomeAmount('');
    }
    showFeedback(
      type === 'gasto'
        ? `Gasto de ${formatCurrency(amount)} registrado`
        : `Ingreso de ${formatCurrency(amount)} registrado`
    );
    await load();
  };

  const renderChips = (
    categories: Category[],
    selectedId: number | null,
    onSelect: (id: number) => void,
    accentColor: string
  ) => (
    <View style={styles.chips}>
      {categories.map((category) => {
        const selected = category.id === selectedId;
        return (
          <Pressable
            key={category.id}
            onPress={() => onSelect(category.id)}
            style={[
              styles.chip,
              { borderColor: palette.border, backgroundColor: palette.background },
              selected && { backgroundColor: accentColor, borderColor: accentColor },
            ]}>
            <Text style={[styles.chipText, { color: selected ? '#fff' : palette.text }]}>
              {category.name}
            </Text>
          </Pressable>
        );
      })}
      {categories.length === 0 && (
        <Text style={{ color: palette.muted }}>Añade categorías desde Ajustes.</Text>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: palette.text }]}>Agregar</Text>

        <View
          style={[styles.baseBanner, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <MaterialCommunityIcons name="bank" size={20} color={palette.muted} />
          {baseAccount ? (
            <Text style={[styles.baseText, { color: palette.text }]}>
              Cuenta Base: <Text style={{ fontWeight: '700' }}>{baseAccount.name}</Text>
              {'  ·  '}
              {formatCurrency(baseAccount.balance)}
            </Text>
          ) : (
            <Text style={[styles.baseText, { color: palette.danger }]}>
              Sin Cuenta Base. Configúrala en Ajustes.
            </Text>
          )}
        </View>

        {feedback && (
          <View style={[styles.feedback, { backgroundColor: palette.success }]}>
            <MaterialCommunityIcons name="check-circle" size={18} color="#fff" />
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        )}

        {/* ----- Gastos ----- */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="arrow-down-circle" size={22} color={palette.danger} />
            <Text style={[styles.cardTitle, { color: palette.text }]}>Gasto</Text>
          </View>
          <TextInput
            style={[
              styles.input,
              { borderColor: palette.border, color: palette.text, backgroundColor: palette.background },
            ]}
            placeholder="0,00 €"
            placeholderTextColor={palette.muted}
            keyboardType="decimal-pad"
            value={expenseAmount}
            onChangeText={setExpenseAmount}
          />
          <Text style={[styles.sectionLabel, { color: palette.muted }]}>Categoría</Text>
          {renderChips(expenseCategories, expenseCategoryId, setExpenseCategoryId, palette.danger)}
          <Pressable
            style={[styles.button, { backgroundColor: palette.danger }]}
            onPress={() => handleAdd('gasto')}>
            <Text style={styles.buttonText}>Agregar Gasto</Text>
          </Pressable>
        </View>

        {/* ----- Ingresos ----- */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="arrow-up-circle" size={22} color={palette.success} />
            <Text style={[styles.cardTitle, { color: palette.text }]}>Ingreso</Text>
          </View>
          <TextInput
            style={[
              styles.input,
              { borderColor: palette.border, color: palette.text, backgroundColor: palette.background },
            ]}
            placeholder="0,00 €"
            placeholderTextColor={palette.muted}
            keyboardType="decimal-pad"
            value={incomeAmount}
            onChangeText={setIncomeAmount}
          />
          <Text style={[styles.sectionLabel, { color: palette.muted }]}>Tipo de ingreso</Text>
          {renderChips(incomeCategories, incomeCategoryId, setIncomeCategoryId, palette.success)}
          <Pressable
            style={[styles.button, { backgroundColor: palette.success }]}
            onPress={() => handleAdd('ingreso')}>
            <Text style={styles.buttonText}>Agregar Ingreso</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  baseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  baseText: {
    fontSize: 14,
    flex: 1,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 10,
  },
  feedbackText: {
    color: '#fff',
    fontWeight: '600',
    flex: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
