import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './AppText';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { CONSENT_ITEMS, REQUIRED_CONSENT_KEYS } from '../../constants/legal';

const Checkbox = ({ checked }) => (
  <View style={[styles.box, checked && styles.boxChecked]}>
    {checked && <Text style={styles.check}>✓</Text>}
  </View>
);

/**
 * 회원가입 동의 목록.
 *
 * value 는 { [key]: boolean } 이고, 바뀔 때마다 onChange 로 통째로 돌려준다.
 * "전체 동의"는 별도 상태를 두지 않고 항목 전부가 켜졌는지로만 판단한다 —
 * 따로 들고 있으면 개별 항목을 끌 때 둘이 어긋난다.
 */
export const ConsentCheckList = ({ value, onChange, onOpenDocument, disabled = false }) => {
  const allChecked = CONSENT_ITEMS.every((item) => value[item.key]);

  const toggleAll = () => {
    const next = {};
    CONSENT_ITEMS.forEach((item) => { next[item.key] = !allChecked; });
    onChange(next);
  };

  const toggle = (key) => onChange({ ...value, [key]: !value[key] });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        accessibilityRole="checkbox"
        accessibilityState={{ checked: allChecked, disabled }}
        onPress={toggleAll}
        disabled={disabled}
        activeOpacity={0.75}
        style={styles.allRow}
      >
        <Checkbox checked={allChecked} />
        <Text style={styles.allLabel}>전체 동의</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      {CONSENT_ITEMS.map((item) => (
        <View key={item.key} style={styles.row}>
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!value[item.key], disabled }}
            onPress={() => toggle(item.key)}
            disabled={disabled}
            activeOpacity={0.75}
            style={styles.rowMain}
          >
            <Checkbox checked={!!value[item.key]} />
            <Text style={styles.label}>
              <Text style={item.required ? styles.tagRequired : styles.tagOptional}>
                {item.required ? '[필수] ' : '[선택] '}
              </Text>
              {item.label}
            </Text>
          </TouchableOpacity>

          {!!item.documentId && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`${item.label} 전문 보기`}
              onPress={() => onOpenDocument(item.documentId)}
              disabled={disabled}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.viewLink}>보기</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
};

export const hasAllRequiredConsents = (value) => REQUIRED_CONSENT_KEYS.every((key) => value[key]);

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 16,
  },
  allRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  allLabel: {
    color: DrawerTheme.ivory,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  divider: {
    height: 1,
    backgroundColor: DrawerTheme.archiveBorder,
    marginVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    flex: 1,
    color: DrawerTheme.archiveIvorySoft,
    fontSize: 12.5,
    lineHeight: 19,
  },
  tagRequired: {
    color: DrawerTheme.brightGold,
    fontWeight: '800',
  },
  tagOptional: {
    color: DrawerTheme.mutedPurple,
    fontWeight: '800',
  },
  viewLink: {
    color: DrawerTheme.mutedIvory,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  box: {
    width: 19,
    height: 19,
    borderRadius: 5,
    borderWidth: 1.4,
    borderColor: DrawerTheme.archiveBorderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: DrawerTheme.brightGold,
    borderColor: DrawerTheme.brightGold,
  },
  check: {
    color: DrawerTheme.bgBlackCherry,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 15,
  },
});
