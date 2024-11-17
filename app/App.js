import React, { useState } from 'react';
import {
  View,
  TextInput,
  Button,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Audio } from 'expo-av'; // For audio recording
import * as FileSystem from 'expo-file-system'; // For handling file storage

export default function App() {
  const [text, setText] = useState('');
  const [queryResponse, setQueryResponse] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recording, setRecording] = useState(null);

  // Function to clean the response text
  const cleanText = (text) => {
    // Remove markdown formatting: bold, italics, headers, etc.
    let cleanedText = text.replace(/(\*\*|__)(.*?)\1/g, '$2'); // Remove bold/italic
    cleanedText = cleanedText.replace(/#{1,6}\s*(.*?)\s*#{1,6}/g, '$1'); // Remove headers (e.g., ### Header)
    cleanedText = cleanedText.replace(/^-{3,}/g, ''); // Remove horizontal lines
    cleanedText = cleanedText.replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Remove links
    
    // Remove Unicode escape sequences (e.g., \u20b9 for currency symbol)
    cleanedText = cleanedText.replace(/\\u[0-9A-Fa-f]{4}/g, '');

    // Remove extra spaces, newlines, and other special characters
    cleanedText = cleanedText.replace(/[\n\r\t]+/g, ' '); // Remove line breaks and tabs
    cleanedText = cleanedText.replace(/\s{2,}/g, ' '); // Replace multiple spaces with a single space

    return cleanedText.trim(); // Trim extra spaces at the beginning and end
  };

  const handleSend = async () => {
    if (text.trim() === '') return; // Avoid sending empty queries
    setIsLoading(true);

    try {
      const res = await fetch('http://192.168.0.100:5000/query', { // Replace with your backend IP
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: text }),
      });

      const responseText = await res.text();
      console.log('Raw Response:', responseText);

      // Clean the response text to remove unwanted characters
      const cleanedResponse = cleanText(responseText);

      try {
        const data = JSON.parse(cleanedResponse);
        setQueryResponse(prevResponses => [
          ...prevResponses,
          { query: text, response: data.response },
        ]);
      } catch (error) {
        console.error('Error parsing JSON:', error);
        setQueryResponse(prevResponses => [
          ...prevResponses,
          { query: text, response: 'Failed to parse server response.' },
        ]);
      }

      setText('');
    } catch (error) {
      console.error('Error:', error);
      setQueryResponse(prevResponses => [
        ...prevResponses,
        { query: text, response: 'Failed to connect to the backend.' },
      ]);
      setText('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudioInput = async () => {
    if (recording) {
      // Stop recording
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log('Recording stopped and stored at', uri);

      // Transcribe audio
      try {
        const transcription = await transcribeAudio(uri);
        setText(transcription);
      } catch (error) {
        console.error('Error during transcription:', error);
        Alert.alert('Error', 'Failed to transcribe audio.');
      }

      setRecording(null);
    } else {
      // Start recording
      try {
        console.log('Requesting permissions..');
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Denied', 'Please grant microphone permission to record audio.');
          return;
        }

        console.log('Starting recording..');
        const { recording } = await Audio.Recording.createAsync(
          Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
        );
        setRecording(recording);
        console.log('Recording started');
      } catch (err) {
        console.error('Failed to start recording', err);
      }
    }
  };

  const transcribeAudio = async (uri) => {
    try {
      const file = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Use your ASR API here (e.g., Google Speech-to-Text, OpenAI Whisper)
      const res = await fetch('YOUR_ASR_API_ENDPOINT', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer YOUR_API_KEY', // Replace with your API key
        },
        body: JSON.stringify({
          audio: file,
          language: 'kn-IN', // Kannada language code
        }),
      });

      const data = await res.json();
      console.log('Transcription response:', data);

      // Assuming the API returns transcribed text in `data.text`
      return data.text || 'No transcription available';
    } catch (error) {
      console.error('Error during transcription:', error);
      throw error;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollView}>
        {queryResponse.map((item, index) => (
          <View key={index} style={styles.queryResponseContainer}>
            <Text style={styles.queryText}>
              Query: <Text style={styles.highlight}>{item.query}</Text>
            </Text>
            <Text style={styles.responseText}>
              Response: {item.response}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter your query"
          placeholderTextColor="gray"
          value={text}
          onChangeText={setText}
        />
        <TouchableOpacity style={styles.audioButton} onPress={handleAudioInput}>
          <FontAwesome name={recording ? "stop" : "microphone"} size={24} color="white" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
        {isLoading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.sendButtonText}>Send</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#1E1E2C',
  },
  scrollView: {
    flexGrow: 1,
    marginBottom: 20,
  },
  queryResponseContainer: {
    marginBottom: 15,
    backgroundColor: '#2A2A3C',
    padding: 15,
    borderRadius: 10,
  },
  queryText: {
    fontSize: 16,
    color: 'white',
    marginBottom: 5,
  },
  responseText: {
    fontSize: 16,
    color: '#D4D4D6',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#2A2A3C',
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: 'white',
    fontSize: 16,
  },
  audioButton: {
    marginLeft: 10,
    backgroundColor: '#3C3C4E',
    padding: 10,
    borderRadius: 25,
  },
  sendButton: {
    height: 50,
    backgroundColor: '#4C8BF5',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  sendButtonText: {
    fontSize: 18,
    color: 'white',
    fontWeight: 'bold',
  },
  highlight: {
    color: '#FFD700',
  },
});
