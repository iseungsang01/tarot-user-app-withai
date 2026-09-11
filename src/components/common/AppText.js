import { StyleSheet, Text as RNText, TextInput as RNTextInput } from 'react-native';
import { resolveBodyFont } from '../../constants/Typography';

/**
 * 앱 전역 텍스트. react-native 의 Text/TextInput 대신 이걸 쓴다.
 *
 * 리액트 19 부터 함수형 컴포넌트의 defaultProps 가 무시돼서 Text.defaultProps 로
 * 서체를 심는 옛날 방식은 통하지 않는다. 대신 여기서 굵기에 맞는 패밀리를 얹는다.
 * fontFamily 를 직접 지정한 스타일(장식 서체, 모노스페이스)은 건드리지 않는다.
 */
const withBodyFont = (style) => {
  const flat = StyleSheet.flatten(style);
  if (flat?.fontFamily) return style;
  return [style, resolveBodyFont(flat?.fontWeight)];
};

export const Text = ({ style, ...props }) => <RNText {...props} style={withBodyFont(style)} />;

export const TextInput = ({ style, ...props }) => (
  <RNTextInput {...props} style={withBodyFont(style)} />
);
