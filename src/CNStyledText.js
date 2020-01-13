import React, { Component } from 'react';
import { Text, StyleSheet, Platform } from 'react-native';
import _ from 'lodash';

const isAndroid = Platform.OS === 'android';

class CNStyledText extends Component {
  constructor(props) {
    super(props);
  }


  shouldComponentUpdate(nextProps) {
    if (_.isEqual(this.props.text, nextProps.text)
            && _.isEqual(this.props.style, nextProps.style)

    ) {
      return false;
    }


    return true;
  }

  renderBaseText = (text = this.props.text) => (
    <Text style={this.props.style}>
      {text}
    </Text>
  );

  renderMultilineAndroidText = (text = this.props.text) => {
    if (!text || text === '\n') {
      return this.renderBaseText();
    }

    const multilineTextItems = text.split('\n');

    return (
      <React.Fragment>
        {multilineTextItems.map(text => (this.renderBaseText(text || '\n')))}
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
