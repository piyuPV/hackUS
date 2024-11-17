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
  ActivityIndicator,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Audio } from 'expo-av'; // For audio recording
import * as FileSystem from 'expo-file-system'; // For handling file storage
import * as Speech from 'expo-speech'; // For text-to-speech
import axios from 'axios'; // For making HTTP requests

export default function App() {
  const [text, setText] = useState('');
  const [queryResponse, setQueryResponse] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recording, setRecording] = useState(null);

  // Function to clean the response text
  const cleanText = (text) => {
    let cleanedText = text.replace(/(\*\*|__)(.*?)\1/g, '$2'); // Remove bold/italic
    cleanedText = cleanedText.replace(/#{1,6}\s*(.*?)\s*#{1,6}/g, '$1'); // Remove headers (e.g., ### Header)
    cleanedText = cleanedText.replace(/^-{3,}/g, ''); // Remove horizontal lines
    cleanedText = cleanedText.replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Remove links
    cleanedText = cleanedText.replace(/\\u[0-9A-Fa-f]{4}/g, ''); // Remove Unicode escape sequences
    cleanedText = cleanedText.replace(/[\n\r\t]+/g, ' '); // Remove line breaks and tabs
    cleanedText = cleanedText.replace(/\s{2,}/g, ' '); // Replace multiple spaces with a single space
    return cleanedText.trim(); // Trim extra spaces at the beginning and end
  };

  const handleSend = async () => {
    if (text.trim() === '') return;
    setIsLoading(true);

    try {
      const res = await fetch('https://demuna.pythonanywhere.com/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: text }),
      });

      const responseText = await res.text();
      console.log('Raw Response:', responseText);

      const cleanedResponse = cleanText(responseText);

      try {
        const data = JSON.parse(cleanedResponse);
        setQueryResponse((prevResponses) => [
          ...prevResponses,
          { query: text, response: data.response },
        ]);
      } catch (error) {
        console.error('Error parsing JSON:', error);
        setQueryResponse((prevResponses) => [
          ...prevResponses,
          { query: text, response: 'Failed to parse server response.' },
        ]);
      }

      setText('');
    } catch (error) {
      console.error('Error:', error);
      setQueryResponse((prevResponses) => [
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
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log('Recording stopped and stored at', uri);

      try {
        const transcription = await transcribeAudio(uri);
        setText(transcription);
      } catch (error) {
        console.error('Error during transcription:', error);
        Alert.alert('Error', 'Failed to transcribe audio.');
      }

      setRecording(null);
    } else {
      try {
        console.log('Requesting permissions..');
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Permission Denied',
            'Please grant microphone permission to record audio.'
          );
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

      const res = await fetch('YOUR_ASR_API_ENDPOINT', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer YOUR_API_KEY',
        },
        body: JSON.stringify({
          audio: file,
          language: 'kn-IN',
        }),
      });

      const data = await res.json();
      console.log('Transcription response:', data);

      return data.text || 'No transcription available';
    } catch (error) {
      console.error('Error during transcription:', error);
      throw error;
    }
  };

  // Function to translate text from English to Kannada
  const translateToKannada = async (text) => {
    try {
      const response = await axios.post('https://libretranslate.com/translate', {
        q: text,
        source: 'en',
        target: 'kn',
        format: 'text',
      });

      return response.data.translatedText;
    } catch (error) {
      console.error('Translation Error:', error);
      return text; // Fallback to the original text if translation fails
    }
  };

  const speakResponse = async (text, language = 'en-US') => {
    if (language === 'kn-IN') {
      // Translate text to Kannada if language is Kannada
      const translatedText = await translateToKannada(text);
      Speech.speak(translatedText, { language: 'kn-IN' });
    } else {
      // Speak in English
      Speech.speak(text, { language });
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
            <View style={styles.speakerButtons}>
              <TouchableOpacity
                style={styles.speakerButton}
                onPress={() => speakResponse(item.response, 'en-US')}
              >
                <FontAwesome name="volume-up" size={20} color="white" />
                <Text style={styles.speakerButtonText}>English</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.speakerButton}
                onPress={() => speakResponse(item.response, 'kn-IN')}
              >
                <FontAwesome name="volume-up" size={20} color="white" />
                <Text style={styles.speakerButtonText}>Kannada</Text>
              </TouchableOpacity>
            </View>
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
          <FontAwesome
            name={recording ? 'stop' : 'microphone'}
            size={24}
            color="white"
          />
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
    color: 'lightgray',
    marginBottom: 10,
  },
  speakerButtons: {
    flexDirection: 'row',
  },
  speakerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A3A4B',
    padding: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  speakerButtonText: {
    color: 'white',
    marginLeft: 5,
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: '#3A3A4B',
    color: 'white',
    padding: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
  },
  audioButton: {
    backgroundColor: '#FF5722',
    padding: 10,
    borderRadius: 5,
  },
});
