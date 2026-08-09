import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * The last line of defence.
 *
 * In development a thrown error gets a red screen explaining itself. In a
 * release build it gets nothing — the app shows white, or closes, with no
 * message and no way forward. On a phone the learner cannot open a console or
 * read a stack trace, and reinstalling costs them every level and streak they
 * have earned, since progress lives only on the device.
 *
 * Everything here is deliberately self-contained: react-native's own
 * components, literal colours, and text in both languages rather than i18n.
 * Theming and translation are among the things that can fail on the way up, and
 * a boundary that depends on what it is catching is not a boundary.
 */

type Props = {
  children: React.ReactNode;
  /** Optional context: what the app was doing when this happened. */
  title?: string;
};

type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  private retry = () => this.setState({ error: null });

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>{this.props.title ?? 'משהו השתבש'}</Text>
        <Text style={styles.subtitle}>Something went wrong</Text>
        <Text style={styles.message}>{error.message}</Text>

        <Pressable style={styles.button} onPress={this.retry}>
          <Text style={styles.buttonText}>נסה שוב · Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12100E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: { color: '#F6F2EC', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#B8AEA2', fontSize: 15, textAlign: 'center' },
  message: {
    color: '#E0736A',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 420,
  },
  button: {
    marginTop: 24,
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: '#C7743A',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
