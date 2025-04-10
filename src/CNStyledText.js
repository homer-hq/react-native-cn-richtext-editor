import React, { Component } from 'react';
import { Text, StyleSheet, Platform } from 'react-native';
import _ from 'lodash';

const isAndroid = Platform.OS === 'android';
const styles = StyleSheet.create({
  ul: { letterSpacing: 6 },
});

class CNStyledText extends Component {
  shouldComponentUpdate(nextProps) {
    if (_.isEqual(this.props.text, nextProps.text) && _.isEqual(this.props.style, nextProps.style)) {
      return false;
    }

    return true;
  }

  componentDidUpdate(prevProps) {
    if (this.props.onChangeTail
      && this.props.text !== prevProps.text
      // compare last 5 chars of string
      && this.props.text.slice(-5) !== prevProps.text.slice(-5)
    ) {
      this.props.onChangeTail();
    }
  }

  renderBaseText = (text = this.props.text, key = undefined) => {
    const isBullet = text === '\u2022' || text === '\n\u2022';
    const crossplatformStyles = { ...StyleSheet.flatten(this.props.style) };

    if (this.props.crossPlatformFonts) {
      crossplatformStyles.fontFamily = _.get(
        this.props.crossPlatformFonts,
        `${crossplatformStyles.fontFamily}.font`,
        crossplatformStyles.fontFamily
      );
    }

    return (
      <Text
        style={[crossplatformStyles, isBullet && styles.ul]}
        key={key}
      >
        {text}
      </Text>
    );
  }

  renderMultilineAndroidText = (text = this.props.text) => {
    if (!text || text === '\n') {
      return this.renderBaseText();
    }

    const multilineTextItems = text.split('\n');

    return (
      <React.Fragment>
        {multilineTextItems.map((text, i) => (this.renderBaseText(text || '\n', `key-${i}-${text}`)))}
      </React.Fragment>
    );
  };

  render() {
    return isAndroid
      ? this.renderMultilineAndroidText()
      : this.renderBaseText();
  }
}

export default CNStyledText;
