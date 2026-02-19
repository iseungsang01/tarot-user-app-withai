import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { CustomButton } from './CustomButton';
import { styles } from '../styles/SettingsStyles';

export const SettingReportManager = ({ myReports, onSubmit, getStatusColor, processing }) => {
  const [reportData, setReportData] = useState({ 
    title: '', description: '', report_type: '어플 버그', category: 'app' 
  });

  const handleCategoryChange = useCallback((category) => {
    setReportData(prev => ({ 
      ...prev, 
      category, 
      report_type: category === 'app' ? '어플 버그' : '가게 불편사항' 
    }));
  }, []);

  const handleFieldChange = (field, value) => {
    setReportData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <View style={styles.formCard}>
      <Text style={styles.innerTitle}>📝 새로운 문의 접수</Text>
      <View style={styles.categoryRow}>
        {['app', 'store'].map(cat => (
          <TouchableOpacity 
            key={cat} 
            style={[styles.categoryButton, reportData.category === cat && styles.categoryButtonActive]} 
            onPress={() => handleCategoryChange(cat)}
          >
            <Text style={[styles.categoryButtonText, reportData.category === cat && styles.categoryButtonTextActive]}>
              {cat === 'app' ? '📱 어플 버그' : '🏪 가게 불편'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput 
        style={styles.input} 
        value={reportData.title} 
        onChangeText={(t) => handleFieldChange('title', t)} 
        placeholder="제목" 
        placeholderTextColor="rgba(166, 137, 102, 0.5)" 
      />
      <TextInput 
        style={[styles.input, styles.textArea]} 
        value={reportData.description} 
        onChangeText={(t) => handleFieldChange('description', t)} 
        placeholder="내용을 입력하세요" 
        placeholderTextColor="rgba(166, 137, 102, 0.5)"
        multiline 
      />
      <CustomButton 
        title="접수하기" 
        onPress={() => onSubmit(reportData)} 
        loading={processing} 
        style={{marginTop: 10}} 
      />

      <View style={styles.sectionDivider} />
      <Text style={styles.innerTitle}>📋 내 접수 내역 ({myReports.length})</Text>
      {myReports.length === 0 ? (
        <Text style={styles.emptyText}>접수 내역이 없습니다.</Text>
      ) : (
        myReports.map(item => (
          <View key={item.id} style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyType}>{item.report_type}</Text>
              <View style={[styles.statusBadge, {borderColor: getStatusColor(item.status)}]}>
                <Text style={[styles.statusText, {color: getStatusColor(item.status)}]}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.historyTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.historyDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
            
            {/* ✅ 관리자 답변 표시 */}
            {item.admin_response && item.admin_response.trim() !== '' && (
              <View style={styles.adminResponseBox}>
                <Text style={styles.adminResponseLabel}>💬 관리자 답변</Text>
                <Text style={styles.adminResponseText}>{item.admin_response}</Text>
              </View>
            )}
          </View>
        ))
      )}
    </View>
  );
};