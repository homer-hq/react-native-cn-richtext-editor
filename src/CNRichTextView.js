import React, { Component } from 'react';
import { View, Text, Image, Platform, StyleSheet } from 'react-native';
import _ from 'lodash';

import { convertToObject } from './Convertors';
import CNStyledText from './CNStyledText';

const isAndroid = Platform.OS === 'android';
const styles = StyleSheet.create({
  imageWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrapper: {
    flexGrow: 1,
  },
});

class CNRichTextView extends Component {
  renderText(contents, index) {
    const { styleList } = this.props;

    return (
      <Text key={contents.id}>
        {
          _.map(contents.content, item => {
            let customStyles = { ...item.styleList };

            if (styleList[item.tag]) {
              customStyles = { ...customStyles, ...styleList[item.tag] };
            }

            item.stype.forEach(key => {
              if (styleList[key]) {
                customStyles = { ...customStyles, ...styleList[key] };
              }
            });

            if (item.stype.includes('bold') && item.stype.includes('italic') && styleList.boldItalic) {
              customStyles = { ...customStyles, ...styleList.boldItalic };
            }

            // fix for android
            if (isAndroid && item.stype.includes('underline') && item.stype.includes('lineThrough')) {
              customStyles = { ...customStyles, textDecorationLine: 'underline line-through' };
            }

            return (
              <CNStyledText
                key={item.id}
                style={customStyles}
                text={item.text}
              />
            );
          })
        }
      </Text>
    );
  }

  renderImage(image, index) {
    const { ImageComponent = Image } = this.props;
    const { width, height } = image.size;

    return (
      <View
        key={`image${index}`}
        style={styles.imageWrapper}
      >
        <View>
          <ImageComponent
            style={{ width, height }}
            source={{ uri: image.url }}
          />
        </View>
      </View>

    );
  }

  render() {
    return (
      <View style={[this.props.style, styles.contentWrapper]}>
        {
          _.map(this.props.value, (item, index) => {
            if (item.component === 'text') {
              return (
                this.renderText(item, index)
              );
            }
            if (item.component === 'image') {
              return (
                this.renderImage(item, index)
              );
            }
          })
        }
      </View>
    );
  }
}

export default CNRichTextView;
