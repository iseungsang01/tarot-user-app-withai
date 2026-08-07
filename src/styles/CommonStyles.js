import { TextColors } from '../constants/Colors';

export const CommonStyles = {
    // 화면 하단의 "돌아가기" 텍스트 링크 (설정·공지 계열 화면 공통)
    backLinkButton: {
        alignSelf: 'center',
        marginTop: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    backLinkText: {
        color: TextColors.subTextHigh,
        fontSize: 14,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
    disabled: {
        opacity: 0.45,
    },
};
