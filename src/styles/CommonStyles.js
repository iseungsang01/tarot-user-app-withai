import { Platform } from 'react-native';
import { DrawerTheme } from '../constants/DrawerTheme';
import { TextColors } from '../constants/Colors';

export const CommonStyles = {
    // 화면 하단의 "돌아가기" 텍스트 링크 (설정 계열 화면 공통)
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

    // 고전풍 게시판/섹션 헤더 공통 스타일 (공지, 설정, 쿠폰, 투표 등에 적용)
    headerBoard: {
        width: '100%',
        maxWidth: 440,
        alignSelf: 'center',
        backgroundColor: DrawerTheme.woodDark,
        borderRadius: 12,
        paddingVertical: 25,
        paddingHorizontal: 20,
        marginBottom: 25,
        borderWidth: 1,
        borderColor: 'rgba(200,163,64,0.34)',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
            },
            android: { elevation: 8 }
        })
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: DrawerTheme.goldBrass,
        letterSpacing: 3,
        fontFamily: Platform.OS === 'ios' ? 'Cochin' : 'serif'
    },
    headerDivider: {
        width: 50,
        height: 1,
        backgroundColor: DrawerTheme.goldBrass,
        marginVertical: 10,
        opacity: 0.72
    },
    subtitle: {
        fontSize: 12,
        color: DrawerTheme.ivory,
        opacity: 0.86,
        textAlign: 'center'
    }
};
