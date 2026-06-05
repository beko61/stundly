import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';

export function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permTitle}>📷 Kamera Zugang</Text>
        <Text style={styles.permText}>Bitte erlaube den Zugriff auf die Kamera, um Stundenzettel zu scannen.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Zugriff erlauben</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const uploadAndScan = async (uri: string) => {
    try {
      setIsProcessing(true);
      setResult(null);

      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1000 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
        encoding: 'base64' as any,
      });

      const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:3000').replace('localhost', '192.168.1.100');

      const payload = { image: `data:image/jpeg;base64,${base64}`, mediaType: 'image/jpeg' };

      const response = await fetch(`${API_URL}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const jsonResponse = await response.json();
      if (!response.ok) throw new Error(jsonResponse.error || 'Scan-Fehler');

      setResult(jsonResponse.parsed);
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        if (photo?.uri) await uploadAndScan(photo.uri);
      } catch { Alert.alert('Fehler', 'Foto konnte nicht aufgenommen werden.'); }
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]?.uri) await uploadAndScan(result.assets[0].uri);
  };

  if (result) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>Erfolgreich gescannt</Text>
        <Text style={styles.successText}>{result.hinweis}</Text>

        {result.eintraege && result.eintraege.length > 0 && (
          <View style={styles.resultCard}>
            <Text style={{ fontWeight: '700', fontSize: 18, color: colors.text }}>
              {result.eintraege.length} Einträge gefunden
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.newScanBtn} onPress={() => setResult(null)}>
          <Text style={styles.newScanBtnText}>Neuen Zettel scannen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} facing="back">
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.processingText}>Anthropic AI analysiert...</Text>
          </View>
        )}

        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.topBarText}>📷 Stundenzettel scannen</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.galleryBtn} onPress={pickImage} disabled={isProcessing}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>🖼️ Galerie</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.captureButton} onPress={takePicture} disabled={isProcessing}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
          <View style={{ width: 80 }} />
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContainer: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: 20 },
  camera: { flex: 1 },
  // Permission
  permTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 10 },
  permText: { fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 20 },
  permBtn: { backgroundColor: colors.accent, paddingVertical: 14, paddingHorizontal: 30, borderRadius: 10 },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Top bar
  topBar: { paddingTop: 50, paddingBottom: 10, paddingHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.5)' },
  topBarText: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  // Buttons
  buttonContainer: { flex: 1, flexDirection: 'row', backgroundColor: 'transparent', alignItems: 'flex-end', justifyContent: 'space-around', paddingBottom: 40 },
  captureButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  captureButtonInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'white' },
  galleryBtn: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 15, borderRadius: 10, width: 80, alignItems: 'center' },
  // Processing
  processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  processingText: { color: 'white', marginTop: 20, fontSize: 18, fontWeight: '600' },
  // Result
  successIcon: { fontSize: 48, marginBottom: 10 },
  successTitle: { fontSize: 24, fontWeight: '800', color: colors.green, marginBottom: 10 },
  successText: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  resultCard: { marginVertical: 20, padding: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, width: '100%', alignItems: 'center' },
  newScanBtn: { backgroundColor: colors.accent, paddingVertical: 14, paddingHorizontal: 30, borderRadius: 10, marginTop: 10 },
  newScanBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
