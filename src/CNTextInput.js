import React, { Component } from 'react';
import { TextInput, StyleSheet, Platform, Text } from 'react-native';
import _ from 'lodash';
import update from 'immutability-helper';
import DiffMatchPatch from 'diff-match-patch';

import CNStyledText from './CNStyledText';
import shortid from 'shortid';

const IS_IOS = Platform.OS === 'ios';
const HIDDEN_SYMBOL = '\u2060';

class CNTextInput extends Component {
  constructor(props) {
    super(props);
    this.DEBUGG_COMPONENT = props.debugMode || false;

    this.textInput = null;
    this.prevSelection = { start: 0, end: 0 };
    this.beforePrevSelection = { start: 0, end: 0 };
    this.avoidSelectionChangeOnFocus = false;
    this.turnOnJustToolOnFocus = false;
    this.textLength = 0;
    this.upComingStype = null;
    this.androidSelectionJump = 0;
    this.shouldGetSelection = false;

    this.AvoidAndroidIssueWhenPressSpace = 0;
    this.checkKeyPressAndroid = 0;

    this.avoidAndroidIssueWhenPressSpaceText = '';
    this.justToolAdded = false;
    this.resetNextSelection = false;

    this.useUpcomingMockStyles = null;
    this.decreaseNextSelection = false;
    this.state = {
      selection: { start: 0, end: 0 },
    };

    this.enterBtnCounter = 0;

    this.dmp = new DiffMatchPatch();
    this.oldText = '';
    this.reCalculateTextOnUpate = false;
    // You can also use the following properties:
    DiffMatchPatch.DIFF_DELETE = -1;
    DiffMatchPatch.DIFF_INSERT = 1;
    DiffMatchPatch.DIFF_EQUAL = 0;
  }

  UNSAFE_componentWillMount() {
    this.DEBUGG_COMPONENT && console.log('--- componentWillMount ---');

    const { items } = this.props;
    if(Array.isArray(items) === true) {
      let content = items;
      for (let i = 0; i < content.length; i++) {
        content[i].styleList = {
          ...(content[i].styleList || {}),
          ...StyleSheet.flatten(this.convertStyleList(content[i].stype)),
        };
      }
      if (this.props.onContentChanged) {
        this.props.onContentChanged(content);
      }
    }   
  }

  componentDidMount() {
    this.DEBUGG_COMPONENT && console.log('--- componentDidMount ---');

    if (this.props.items) {
      this.textLength = 0;
      // for (let index = 0; index < this.props.items.length; index++) {
      //     const element = this.props.items[index];
      //     this.textLength += element.text.length;
      // }
      this.oldText = this.reCalculateText(this.props.items);
      this.textLength = this.oldText.length;
    }
  }

  componentDidUpdate(prevProps, prevState) {
    this.DEBUGG_COMPONENT && console.log('--- componentDidUpdate ---');

    if (this.reCalculateTextOnUpate === true) {
      this.oldText = this.reCalculateText(this.props.items);
      this.textLength = this.oldText.length;
      this.reCalculateTextOnUpate = false;
    }
  }

  forceUpdateWitheCalculate = () => {
    this.DEBUGG_COMPONENT && console.log('--- forceUpdateWitheCalculate ---');

    this.reCalculateTextOnUpate = true;
    this.forceUpdate();
  };

  findContentIndex = (content, cursorPosition) => {
    this.DEBUGG_COMPONENT && console.log('--- findContentIndex ---');

    let indx = 0;
    let findIndx = -1;
    let checknext = true;
    let itemNo = 0;

    for (let index = 0; index < content.length; index++) {
      const element = content[index];

      const ending = indx + element.len;

      if (checknext === false) {
        if (element.len === 0) {
          findIndx = index;
          itemNo = 0;
          break;
        } else {
          break;
        }
      }
      if (cursorPosition <= ending && cursorPosition >= indx) {
        findIndx = index;
        itemNo = cursorPosition - indx;
        checknext = false;
      }

      indx += element.len;
    }

    if (findIndx == -1) {
      findIndx = content.length - 1;
    }

    return { findIndx, itemNo };
  };

  updateContent = (content, item, index, itemNo = 0) => {
    this.DEBUGG_COMPONENT && console.log('--- updateContent ---');

    let newContent = content;
    if (index >= 0 && newContent[index].len === 0) {
      if (item !== null) {
        newContent = update(newContent, { [index]: { $set: item } });
      }
    } else if (itemNo === 0) {
      if (item !== null && index >= 0) {
        newContent = update(newContent, { $splice: [[index, 0, item]] });
      }
    } else if (itemNo === content[index].len) {
      if (item !== null && index >= 0) {
        newContent = update(newContent, { $splice: [[index + 1, 0, item]] });
      }
    } else if (itemNo > 0) {
      const foundElement = content[index];
      const beforeContent = {
        id: foundElement.id,
        len: itemNo,
        stype: foundElement.stype,
        styleList: foundElement.styleList,
        tag: foundElement.tag,
        text: foundElement.text.substring(0, itemNo),
      };

      const afterContent = {
        id: shortid.generate(),
        len: foundElement.len - itemNo,
        stype: foundElement.stype,
        styleList: foundElement.styleList,
        tag: foundElement.tag,
        text: foundElement.text.substring(itemNo),
      };

      newContent = update(newContent, { [index]: { $set: beforeContent } });
      newContent = update(newContent, { $splice: [[index + 1, 0, afterContent]] });
      newContent = update(newContent, { $splice: [[index + 1, 0, item]] });
    }

    return newContent;
  };

  getSelection = () => {
    this.DEBUGG_COMPONENT && console.log('--- getSelection ---');

    if (this.shouldGetSelection) {
      this.shouldGetSelection = false;
      return this.state.selection;
    }

    return undefined;
  };

  onSelectionChange = (event) => {
    this.DEBUGG_COMPONENT && console.log('--- onSelectionChange ---');

    if (this.useUpcomingMockStyles) {
      return;
    }

    const { selection } = event.nativeEvent;

    if (this.decreaseNextSelection) {
      selection.start -= 1;
      selection.end -= 1;
      this.setState({ selection });
      this.decreaseNextSelection = false;

      return;
    }

    if ((this.justToolAdded === true && selection.start === selection.end && selection.end >= this.textLength)
      || (selection.end === this.state.selection.end && selection.start === this.state.selection.start)
      || (this.justToolAdded === true && this.checkKeyPressAndroid > 0)
    ) {
      this.justToolAdded = false;

      // workaround for bugs at applying styles for selected text (next input char breaks styles)
      if (this.resetNextSelection) {
        this.prevSelection = selection;
        this.beforePrevSelection = selection;
        this.setState({ selection });
        this.resetNextSelection = false;
      }
    } else {
      if (this.justToolAdded == true) {
        this.justToolAdded = false;
      }

      if (this.androidSelectionJump !== 0) {
        selection.start += this.androidSelectionJump;
        selection.end += this.androidSelectionJump;
        this.androidSelectionJump = 0;
        this.shouldGetSelection = true;
      }
      const { upComingStype } = this;
      this.beforePrevSelection = this.prevSelection;
      this.prevSelection = this.state.selection;

      let styles = [];
      let selectedTag = '';

      if (upComingStype !== null) {
        if (upComingStype.sel.start === this.prevSelection.start
              && upComingStype.sel.end === this.prevSelection.end) {
          styles = upComingStype.stype;
          selectedTag = upComingStype.tag;
        } else {
          this.upComingStype = null;
        }
      } else {
        const content = this.props.items;

        const res = this.findContentIndex(content, selection.end);

        styles = content[res.findIndx].stype;
        selectedTag = content[res.findIndx].tag;
      }

      if (this.avoidSelectionChangeOnFocus) {
        this.justToolAdded = true;
      }
      this.avoidSelectionChangeOnFocus = false;
      // if(this.avoidAndroidJump == true) {

      //     this.avoidSelectionChangeOnFocus = true;
      // }
      this.avoidAndroidJump = false;

      if (selection.end >= selection.start) {
        this.setState({
          selection,
        });
      } else {
        this.setState({
          selection: { start: selection.end, end: selection.start },
        });
      }

      if (this.avoidUpdateStyle !== true) {
        if (this.props.onSelectedStyleChanged) {
          this.props.onSelectedStyleChanged(styles);
        }
        if (this.props.onSelectedTagChanged) {
          this.props.onSelectedTagChanged(selectedTag);
        }
      }

      this.notifyMeasureContentChanged(this.props.items);
    }
    this.avoidUpdateStyle = false;
  };

  handleChangeText = (rawText) => {
    this.DEBUGG_COMPONENT && console.log('--- handleChangeText ---');

    let text = rawText;
    const indexOfUpcomingMockStyles = IS_IOS ? -1 : text.lastIndexOf(HIDDEN_SYMBOL);
    this.avoidUpdateStyle = true;

    if (indexOfUpcomingMockStyles > -1) {
      text = text.split(HIDDEN_SYMBOL).join('');
      this.decreaseNextSelection = true;
    }

    if (this.enterBtnCounter > 1) {
      // this.decreaseNextSelection = true;
      return;
    }

    let recalcText = false;
    const { selection } = this.state;
    const { items } = this.props;

    // index of items that newLine should be applied or remove

    const myText = text;

    // get length of current text
    const txtLen = myText.length;
    // get lenght of text last called by handletextchange
    const prevLen = this.textLength;

    const textDiff = txtLen - prevLen;
    let cursorPosition = 0;
    let shouldAddText = textDiff >= 0;
    let shouldRemText = textDiff < 0;
    let remDiff = Math.abs(textDiff);
    let addDiff = Math.abs(textDiff);
    let addCursorPosition = -1;

    if (IS_IOS) {
      if (this.prevSelection.end !== this.prevSelection.start) {
        remDiff = Math.abs(this.prevSelection.end - this.prevSelection.start);
        addDiff = myText.length - (this.textLength - remDiff);
        if (addDiff < 0) {
          remDiff += Math.abs(addDiff);
          addDiff = 0;
        }
        shouldRemText = true;
        shouldAddText = addDiff > 0;
        cursorPosition = this.prevSelection.end;
        addCursorPosition = this.prevSelection.start;
      } else if (textDiff === 0 && this.prevSelection.end === selection.end) {
        remDiff = 1;
        addDiff = 1;
        shouldRemText = true;
        shouldAddText = addDiff > 0;
        cursorPosition = this.prevSelection.end;
        addCursorPosition = this.prevSelection.end - 1;
      } else if (Math.abs(this.prevSelection.end - selection.end) == Math.abs(textDiff)) {
        cursorPosition = this.prevSelection.end;
      } else if (Math.abs(this.prevSelection.end - selection.end) + Math.abs(this.beforePrevSelection.end - this.prevSelection.end) == Math.abs(textDiff)) {
        cursorPosition = this.beforePrevSelection.end;
      } else {
        const diff = Math.abs(textDiff) - Math.abs(this.prevSelection.end - selection.end) - Math.abs(this.beforePrevSelection.end - this.prevSelection.end);

        if (this.beforePrevSelection.end + diff <= prevLen) {
          cursorPosition = this.beforePrevSelection.end + diff;
        } else if (this.textLength < myText.length) {
          cursorPosition = this.prevSelection.end - Math.abs(textDiff);
        } else {
          console.log('error may occure');
          cursorPosition = this.beforePrevSelection.end;
        }
      }
    } else if (selection.end !== selection.start) {
      remDiff = Math.abs(selection.end - selection.start);
      addDiff = Math.abs(this.textLength - remDiff - myText.length);
      shouldRemText = true;
      shouldAddText = addDiff > 0;
      cursorPosition = selection.end;
      addCursorPosition = selection.start;
    } else {
      cursorPosition = selection.end;
    }

    let content = items;

    let upComing = null;

    if (IS_IOS === false
          && shouldAddText === true
          && text.length > cursorPosition + addDiff
    ) {
      const txt = text.substr(cursorPosition + addDiff, 1);
      if (txt !== ' ') {
        const bef = text.substring(0, cursorPosition + addDiff);
        const aft = text.substring(cursorPosition + addDiff);

        const lstIndx = bef.lastIndexOf(' ');
        if (lstIndx > 0) {
          this.AvoidAndroidIssueWhenPressSpace = 3;
        } else {
          this.AvoidAndroidIssueWhenPressSpace = 3;
        }
      }
    }

    let preparedText = this.oldText;
    if (shouldRemText === true) {
      preparedText = preparedText.substring(0, cursorPosition - remDiff) + preparedText.substring(cursorPosition);
    }

    if (shouldAddText === true) {
      let cursor = cursorPosition;
      if (shouldRemText === true) {
        if (addCursorPosition >= 0) {
          cursor = addCursorPosition;
        }
      }
      const addedText = text.substring(cursor, cursor + addDiff);
      preparedText = preparedText.substring(0, cursor) + addedText + preparedText.substring(cursor);
    }

    if (preparedText === myText) {
      if (shouldRemText === true) {
        const result = this.removeTextFromContent(content, cursorPosition, remDiff);

        upComing = result.upComing;
        content = result.content;
        if (!recalcText) recalcText = result.recalcText;
      }


      if (shouldAddText === true) {
        if (shouldRemText === true) {
          if (addCursorPosition >= 0) {
            cursorPosition = addCursorPosition;
          }
        }
        const addedText = text.substring(cursorPosition, cursorPosition + addDiff);

        const res = this.addTextToContent(content, cursorPosition, addedText);
        content = res.content;
        if (!recalcText) recalcText = res.recalcText;
      }
    } else {
      // shoud compare with

      const mydiff = this.dmp.diff_main(this.oldText, text);

      let myIndex = 0;
      for (let index = 0; index < mydiff.length; index++) {
        const element = mydiff[index];
        let result = null;
        switch (element[0]) {
          case 1:
            result = this.addTextToContent(content, myIndex, element[1]);
            content = result.content;
            myIndex += element[1].length;
            if (!recalcText) recalcText = result.recalcText;
            break;
          case -1:
            myIndex += element[1].length;

            result = this.removeTextFromContent(content, myIndex, element[1].length);
            content = result.content;
            upComing = result.upComing;
            myIndex -= element[1].length;

            if (!recalcText) recalcText = result.recalcText;

            break;
          default:
            myIndex += element[1].length;
            break;
        }
      }
    }

    if (recalcText === true) {
      this.oldText = this.reCalculateText(content);
    } else {
      this.oldText = text;
    }

    let styles = [];
    let tagg = 'body';
    if (upComing === null) {
      const res = this.findContentIndex(content, this.state.selection.end);
      styles = content[res.findIndx].stype;
      tagg = content[res.findIndx].tag;
      // for android styles will update in `selectionChange` callback as it evokes lates [04.03.20]
      this.avoidUpdateStyle = IS_IOS;
    } else {
      styles = upComing.stype;
      tagg = upComing.tag;
    }

    this.upComingStype = upComing;

    this.props.onContentChanged(content);
    if (this.props.onSelectedStyleChanged && !this.decreaseNextSelection && this.avoidUpdateStyle) {
      this.props.onSelectedStyleChanged(styles);
    }

    if (this.props.onSelectedTagChanged && this.avoidUpdateStyle) {
      this.props.onSelectedTagChanged(tagg);
    }

    if (this.props.forceUpdateParent) {
      // replacement for `notifyMeasureContentChanged` which is not required
      // but which evoke rendering of parent component and lead to correct work [02.03.20]
      this.props.forceUpdateParent();
    }

    this.notifyMeasureContentChanged(content);
  };

  addTextToContent = (content, cursorPosition, textToAdd) => {
    this.DEBUGG_COMPONENT && console.log('--- addTextToContent ---');

    let avoidStopSelectionForIOS = false;
    let recalcText = false;
    const result = this.findContentIndex(content, cursorPosition);

    let foundIndex = result.findIndx;
    let foundItemNo = result.itemNo;

    let startWithReadonly = false;

    if (content[foundIndex].readOnly === true) {
      if (content[foundIndex].text.length === foundItemNo) {
        if (content.length > foundIndex + 1
                      && !(content[foundIndex + 1].readOnly === true)
                      && !(content[foundIndex + 1].NewLine === true)
                      && !(this.upComingStype && this.upComingStype.sel.end === cursorPosition)
        ) {
          foundIndex += 1;
          foundItemNo = 0;
        } else if (this.upComingStype
                          && this.upComingStype.sel.end === cursorPosition) {

        } else {
          avoidStopSelectionForIOS = true;
          this.upComingStype = {
            text: '',
            len: 0,
            sel: { start: cursorPosition, end: cursorPosition },
            stype: content[foundIndex].stype,
            tag: content[foundIndex].tag,
            styleList: content[foundIndex].styleList,
          };
        }
      } else {
        startWithReadonly = true;
      }
    }

    if (this.upComingStype !== null && startWithReadonly === false
              && this.upComingStype.sel.end === cursorPosition) {
      content = this.updateContent(content, {
        id: shortid.generate(),
        text: '',
        len: 0,
        stype: this.upComingStype.stype,
        tag: this.upComingStype.tag,
        styleList: this.upComingStype.styleList,
      }, foundIndex, foundItemNo);

      const { findIndx, itemNo } = this.findContentIndex(content, cursorPosition);
      foundIndex = findIndx;
      foundItemNo = itemNo;

      if (IS_IOS === true
          && avoidStopSelectionForIOS === false
          && !(foundIndex === content.length - 1
          && foundItemNo === content[foundIndex].len)
      ) {
        // didn't find reason for it [19.02.20 by Vlad]
        // this.justToolAdded = true;
      }
    }

    this.checkKeyPressAndroid = 0;
    this.textLength += textToAdd.length;

    content[foundIndex].len += textToAdd.length;
    content[foundIndex].text = content[foundIndex].text.substring(0, foundItemNo) + textToAdd + content[foundIndex].text.substring(foundItemNo);

    const newLineIndex = content[foundIndex].text.substring(1).indexOf('\n');
    if (newLineIndex >= 0) {
      const res = this.updateNewLine(content, foundIndex, newLineIndex + 1);
      content = res.content;
      if (!recalcText) {
        recalcText = res.recalcText;
      }
    } else if (content[foundIndex].text.substring(0, 1) == '\n' && content[foundIndex].NewLine != true) {
      const res = this.updateNewLine(content, foundIndex, 0);
      content = res.content;
      if (!recalcText) {
        recalcText = res.recalcText;
      }
    }

    return { content, recalcText };
  };

  removeTextFromContent = (content, cursorPosition, removeLength) => {
    this.DEBUGG_COMPONENT && console.log('--- removeTextFromContent ---');

    let recalcText = false;
    let newLineIndexs = [];
    const removeIndexes = [];
    let upComing = null;
    const result = this.findContentIndex(content, cursorPosition);

    const foundIndex = result.findIndx;
    const foundItemNo = result.itemNo;

    const remDiff = removeLength;

    this.textLength -= remDiff;

    if (foundItemNo >= remDiff) {
      const txt = content[foundIndex].text;

      content[foundIndex].len -= remDiff;
      content[foundIndex].text = txt.substring(0, foundItemNo - remDiff) + txt.substring(foundItemNo, txt.length);

      if (content[foundIndex].NewLine === true) {
        newLineIndexs.push(foundIndex);
      }
      if (content[foundIndex].readOnly === true) {
        removeIndexes.push(content[foundIndex].id);
      }

      if (content[foundIndex].len === 0 && content.length > 1) {
        upComing = {
          len: 0,
          text: '',
          stype: content[foundIndex].stype,
          styleList: content[foundIndex].styleList,
          tag: content[foundIndex].tag,
          sel: {
            start: cursorPosition - 1,
            end: cursorPosition - 1,
          },
        };

        removeIndexes.push(content[foundIndex].id);
      } else if (foundItemNo === 1) {
        upComing = {
          len: 0,
          text: '',
          stype: content[foundIndex].stype,
          styleList: content[foundIndex].styleList,
          tag: content[foundIndex].tag,
          sel: {
            start: cursorPosition - 1,
            end: cursorPosition - 1,
          },
        };
      }
    } else {
      let rem = remDiff - (foundItemNo);

      content[foundIndex].len = content[foundIndex].len - foundItemNo;
      content[foundIndex].text = content[foundIndex].text.substring(foundItemNo);

      if (rem > 0) {
        for (var i = foundIndex - 1; i >= 0; i--) {
          if (content[i].NewLine === true) {
            newLineIndexs.push(i);
          }

          if (content[i].len >= rem) {
            content[i].text = content[i].text.substring(0, content[i].len - rem);
            content[i].len -= rem;
            break;
          } else {
            rem -= content[i].len;
            content[i].len = 0;
            content[i].text = '';
          }
        }
      }

      for (var i = content.length - 1; i >= foundIndex; i--) {
        if (content[i].len === 0) {
          removeIndexes.push(content[i].id);
        }
      }
    }

    // ///// fix //////

    newLineIndexs = newLineIndexs.sort((a, b) => b - a);

    for (let i = 0; i < newLineIndexs.length; i++) {
      const index = newLineIndexs[i];
      const newLineIndex = content[index].text.indexOf('\n');

      if (newLineIndex < 0) {
        if (index > 0) {
          content[index].NewLine = false;
           const beforeTag = content[index - 1].tag;
          const res = this.changeToTagIn(content, content[index - 1].tag, index, false);
          content = res.content;
          if (!recalcText) recalcText = res.recalcText;
        } else if (removeIndexes.indexOf(content[index].id) >= 0) {
          const tagg = content[index].tag;
          if (tagg == 'ul' || tagg === 'ol') {
            const res = this.changeToTagIn(content, 'body', 0, false);
            content = res.content;
            if (!recalcText) recalcText = res.recalcText;
          }
          if (content.length > 1) {
            content[index + 1].NewLine = true;
          } else {

          }
        }
      } else if (removeIndexes.indexOf(content[index].id) >= 0) {
        content[index].NewLine = false;
        content[index].readOnly = false;
        if (index > 0) {
           const beforeTag = content[index - 1].tag;

          const res = this.changeToTagIn(content, content[index - 1].tag, index, false);
          content = res.content;
          if (!recalcText) recalcText = res.recalcText;
        }
      }
    }


    for (let i = 0; i < removeIndexes.length; i++) {
      const remIndex = content.findIndex(x => x.id == removeIndexes[i]);
      if (remIndex < 0) continue;

      if (content[remIndex].len > 0) {
        if (IS_IOS !== true) {
          this.androidSelectionJump -= (content[remIndex].len);
        }
        this.textLength -= content[remIndex].len;
      }

      if (remIndex == 0 && (content.length == 1 || (content.length > 1 && content[1].NewLine == true && content[0].len == 0))) {
        content[0].text = '';
        content[0].len = 0;
        content[0].readOnly = false;
      } else {
        content = content.filter(item => item.id != removeIndexes[i]);
      }
    }

    return {
      content,
      upComing,
      recalcText,
    };
  };

  updateNewLine = (content, index, itemNo) => {
    this.DEBUGG_COMPONENT && console.log('--- updateNewLine ---');

    let newContent = content;
    let recalcText = false;
    const prevTag = newContent[index].tag;
    let isPrevList = false;

    if (prevTag === 'ol' || prevTag == 'ul') {
      isPrevList = true;
      if (IS_IOS === false) {
        // this.avoidAndroidJump = true;
      }
    }

    const isPrevHeading = prevTag === 'heading' || prevTag === 'title';

    const foundElement = newContent[index];

    if (itemNo === 0) {
      newContent[index].NewLine = true;
      const res = this.changeToTagIn(newContent, isPrevList ? prevTag : 'body', index, true);
      newContent = res.content;
      if (!recalcText) recalcText = res.recalcText;
    } else if (itemNo === foundElement.len - 1) {
      newContent[index].len = foundElement.len - 1;
      newContent[index].text = foundElement.text.substring(0, foundElement.text.length - 1);

      newContent[index].NewLine = newContent[index].text.indexOf('\n') === 0 || index === 0;
      if (newContent.length > index + 1 && newContent[index + 1].NewLine !== true) {
        newContent[index + 1].len += 1;
        newContent[index + 1].NewLine = true;
        newContent[index + 1].text = `\n${newContent[index + 1].text}`;
        const res = this.changeToTagIn(newContent, isPrevList ? prevTag : 'body', index + 1, true);
        newContent = res.content;
        if (!recalcText) recalcText = res.recalcText;
      } else {
        const beforeContent = {
          id: shortid.generate(),
          len: 1,
          stype: isPrevHeading === true ? [] : newContent[index].stype,
          styleList: [],
          tag: 'body',
          text: '\n',
          NewLine: true,
        };
        beforeContent.styleList = StyleSheet.flatten(this.convertStyleList(update(beforeContent.stype, { $push: [beforeContent.tag] })));

        newContent = update(newContent, { $splice: [[index + 1, 0, beforeContent]] });
        if (isPrevList === true) {
          const res = this.changeToTagIn(newContent, prevTag, index + 1, true);
          newContent = res.content;
          if (!recalcText) recalcText = res.recalcText;
        }
      }
    } else {
      const beforeContent = {
        id: foundElement.id,
        len: itemNo,
        stype: foundElement.stype,
        styleList: foundElement.styleList,
        tag: foundElement.tag,
        text: foundElement.text.substring(0, itemNo),
        NewLine: foundElement.text.substring(0, itemNo).indexOf('\n') === 0 || index === 0,
      };

      const afterContent = {
        id: shortid.generate(),
        len: foundElement.len - itemNo,
        text: foundElement.text.substring(itemNo, foundElement.len),
        stype: foundElement.stype,
        styleList: foundElement.styleList,
        tag: isPrevList ? prevTag : 'body',
        NewLine: true,
      };

      newContent = update(newContent, { [index]: { $set: beforeContent } });
      newContent = update(newContent, { $splice: [[index + 1, 0, afterContent]] });

      const res = this.changeToTagIn(newContent, isPrevList ? prevTag : 'body', index + 1, true);
      newContent = res.content;
      if (!recalcText) recalcText = res.recalcText;
    }

    return { content: newContent, recalcText };
  };

  createUpComing = (start, end, tag, stype) => {
    this.DEBUGG_COMPONENT && console.log('--- createUpComing ---');

    this.upComingStype = {
      sel: { start, end },
      tag,
      text: '',
      stype,
      styleList: StyleSheet.flatten(this.convertStyleList(update(stype, { $push: [tag] }))),
    };
  };

  addToUpComming = (toolType) => {
    this.DEBUGG_COMPONENT && console.log('--- addToUpComming ---');

    if (this.upComingStype) {
      const indexOfUpToolType = this.upComingStype.stype.indexOf(toolType);
      const newUpStype = this.upComingStype ? (indexOfUpToolType != -1 ? update(this.upComingStype.stype, { $splice: [[indexOfUpToolType, 1]] })
        : update(this.upComingStype.stype, { $push: [toolType] })) : [toolType];
      this.upComingStype.stype = newUpStype;
      this.upComingStype.styleList = StyleSheet.flatten(this.convertStyleList(update(newUpStype, { $push: [this.upComingStype.tag] })));
    }
  };

  applyStyle = (toolType) => {
    this.DEBUGG_COMPONENT && console.log('--- applyStyle ---');

    if (this.useUpcomingMockStyles) {
      this.useUpcomingMockStyles = null;
    }

    const { selection: { start, end } } = this.state;
    const { items } = this.props;

    const newCollection = [];

    const content = items;
    let indx = 0;
    let upComingAdded = false;

    const currentContentIndex = this.findContentIndex(content, end);
    const currentStype = currentContentIndex ? content[currentContentIndex.findIndx].stype : [];
    const isNewToolType = !currentStype.includes(toolType);

    for (let i = 0; i < content.length; i++) {
      const { id, len, stype, tag, text, styleList } = content[i];
      const NewLine = content[i].NewLine ? content[i].NewLine : false;
      const readOnly = content[i].readOnly ? content[i].readOnly : false;

      const indexOfToolType = stype.indexOf(toolType);
      const newStype = isNewToolType
        ? ( (indexOfToolType !== -1) ? stype : update(stype, { $push: [toolType] }) )
        : ( (indexOfToolType !== -1) ? update(stype, { $splice: [[indexOfToolType, 1]] }) : stype );

      const newStyles = StyleSheet.flatten(this.convertStyleList(update(newStype, { $push: [tag] })));

      const from = indx;
      indx += len;
      const to = indx;

      if (readOnly) {
        newCollection.push({
          id,
          text,
          len: to - from,
          tag,
          stype,
          styleList,
          NewLine,
          readOnly,
        });

        if (i === content.length - 1 && start === end && end === to) {
          if (upComingAdded === false) {
            if (this.upComingStype === null
                                  || (this.upComingStype.sel.start === start && this.upComingStype.sel.end === end) == false) {
              this.createUpComing(start, end, tag, newStype);
            } else {
              this.addToUpComming(toolType);
            }

            upComingAdded = true;
          }
        }
      } else if ((start >= from && start < to) && (end >= from && end < to)) {
        if (start !== end) {
          if (start !== from) {
            newCollection.push({
              id,
              text: text.substring(0, start - from),
              len: start - from,
              stype,
              styleList,
              tag,
              NewLine,
              readOnly,
            });
          }

          newCollection.push({
            id: shortid.generate(),
            text: text.substring(start - from, end - from),
            len: end - start,
            tag,
            stype: newStype,
            styleList: newStyles,
          });

          if (end !== to) {
            newCollection.push({
              id: shortid.generate(),
              text: text.substring(end - from, to - from),
              len: to - end,
              tag,
              stype,
              styleList,
            });
          }
        } else {
          newCollection.push({
            id,
            text,
            len: to - from,
            tag,
            stype,
            styleList,
            NewLine,
            readOnly,
          });

          if (upComingAdded === false) {
            if (this.upComingStype === null
                                  || (this.upComingStype.sel.start === start && this.upComingStype.sel.end === end) == false) {
              this.createUpComing(start, end, tag, newStype);
            } else {
              this.addToUpComming(toolType);
            }
            upComingAdded = true;
          }
        }
      } else if (start >= from && start < to) {
        if (start !== from) {
          newCollection.push({
            id,
            len: start - from,
            text: text.substring(0, start - from),
            stype,
            styleList,
            tag,
            NewLine,
            readOnly,
          });
        }

        newCollection.push({
          id: shortid.generate(),
          len: to - start,
          text: text.substring(start - from, to - from),
          tag,
          stype: newStype,
          styleList: newStyles,
        });
      } else if (end > from && end <= to) {
        if (start === end) {
          newCollection.push({
            id,
            text,
            len: to - from,
            stype,
            styleList,
            tag,
            NewLine,
            readOnly,

          });

          if (upComingAdded === false) {
            if (this.upComingStype === null || (this.upComingStype.sel.start === start && this.upComingStype.sel.end === end) == false) {
              this.createUpComing(start, end, tag, newStype);
            } else {
              this.addToUpComming(toolType);
            }
            upComingAdded = true;
          }
        } else {
          newCollection.push({
            id: shortid.generate(),
            text: text.substring(0, end - from),
            len: end - from,
            tag,
            NewLine,
            stype: newStype,
            styleList: newStyles,
          });

          if (end !== to) {
            newCollection.push({
              id,
              text: text.substring(end - from, to - from),
              len: to - end,
              tag,
              stype,
              styleList,
              readOnly,

            });
          }
        }
      } else if (from === to && start === from && end === to) {
        newCollection.push({
          id,
          text,
          len: to - from,
          tag,
          stype,
          styleList,
          NewLine,
          readOnly,
        });

        if (upComingAdded === false) {
          if (this.upComingStype === null || (this.upComingStype.sel.start === start && this.upComingStype.sel.end === end) == false) {
            this.createUpComing(start, end, tag, newStype);
          } else {
            this.addToUpComming(toolType);
          }

          upComingAdded = true;
        }
      } else if ((from >= start && from <= end) && (to >= start && to <= end)) {
        newCollection.push({
          id,
          text,
          len: to - from,
          tag,
          stype: newStype,
          styleList: newStyles,
          NewLine,
          readOnly,

        });
      } else {
        newCollection.push({
          id,
          text,
          len: to - from,
          tag,
          stype,
          styleList,
          NewLine,
          readOnly,

        });
      }
    }

    const { findIndx } = this.findContentIndex(newCollection, this.state.selection.end);

    let styles = [];
    if (this.upComingStype != null) {
      styles = this.upComingStype.stype;
    } else {
      styles = newCollection[findIndx].stype;
    }

    this.justToolAdded = start !== end;
    // not shure about reson of `justToolAdded`, so this one is for prevent wrong behaviour
    // at applying styles at selected text
    this.resetNextSelection = start !== end;

    this.props.onContentChanged(newCollection);

    if (this.props.onSelectedStyleChanged) {
      this.props.onSelectedStyleChanged(styles);
    }

    const shouldUseUpcomingMockStyles = !IS_IOS && (findIndx === this.props.items.length - 1);

    if (shouldUseUpcomingMockStyles) {
      this.useUpcomingMockStyles = this.getStylesByStype(styles);
      this.forceUpdateWitheCalculate();
    }
  };

  reCalculateText = (content) => {
    this.DEBUGG_COMPONENT && console.log('--- reCalculateText ---');

    let text = '';
    for (let i = 0; i < content.length; i++) {
      text += content[i].text;
    }
    this.androidSelectionJump = 0;

    return text;
  };

  applyTag = (tagType) => {
    this.DEBUGG_COMPONENT && console.log('--- applyTag ---');

    const { items } = this.props;
    const { selection } = this.state;

    const res = this.findContentIndex(items, selection.end);
    const { content, recalcText } = this.changeToTagIn(items, tagType, res.findIndx);

    if (recalcText == true) {
      this.oldText = this.reCalculateText(content);
    }

    if (this.props.onContentChanged) {
      this.props.onContentChanged(content);
    }

    if (this.props.onSelectedTagChanged) {
      this.props.onSelectedTagChanged(tagType);
    }

    this.notifyMeasureContentChanged(content);
  };

  notifyMeasureContentChanged = (content) => {
    this.DEBUGG_COMPONENT && console.log('--- notifyMeasureContentChanged ---');

    if (this.props.onMeasureContentChanged) {
      try {
        setTimeout(() => {
          const res = this.findContentIndex(content, this.state.selection.end);

          const measureArray = content.slice(0, res.findIndx);
          measureArray.push({
            id: shortid.generate(),
            len: res.itemNo,
            stype: content[res.findIndx].stype,
            styleList: content[res.findIndx].styleList,
            text: content[res.findIndx].text.substring(0, res.itemNo + 1),
            tag: content[res.findIndx].tag,
            NewLine: content[res.findIndx].NewLine,
            readOnly: content[res.findIndx].readOnly,
          });
          this.props.onMeasureContentChanged(measureArray);
        }, 100);
      } catch (error) {

      }
    }
  };

  changeToTagIn = (items, tag, index, fromTextChange = false) => {
    this.DEBUGG_COMPONENT && console.log('--- changeToTagIn ---');

    let recalcText = false;
    const needBold = tag === 'heading' || tag === 'title';
    let content = items;
    let skipFromTextChangeFix = false;

    // emulate last empty 'ul' line as workaround for bullet list bug [03.03.20]
    if (content[index].tag === 'ul' && tag === 'body' && content[index].text.length > 0) {
      const newLine = {
        id: shortid.generate(),
        len: 2,
        stype: [],
        styleList: [],
        tag: 'ul',
        text: '\n\u2022',
        NewLine: true,
        readOnly: true,
      };
      content = update(content, { $splice: [[index + 1, 0, newLine]] });
      this.textLength += 2;
      index += 1;
    }

    for (let i = index + 1; i < content.length; i++) {
      if (content[i].NewLine === true) {
        break;
      } else {
        if (needBold === true && content[i].stype.indexOf('bold') == -1) {
          content[i].stype = update(content[i].stype, { $push: ['bold'] });
        } else if (needBold === false
          && (content[i].tag === 'heading' || content[i].tag === 'title')
          && content[i].stype.indexOf('bold') != -1
        ) {
          content[i].stype = content[i].stype.filter(typ => typ != 'bold');
        }
        content[i].tag = tag;
        content[i].styleList = StyleSheet.flatten(this.convertStyleList(update(content[i].stype, { $push: [content[i].tag] })));
      }
    }

    let shouldReorderList = false;

    for (let i = index; i >= 0; i--) {
      if (content[i].NewLine === true && content[i].tag === 'ol') {
        shouldReorderList = true;
      }

      if (needBold === true
        // (content[i].tag === 'heading' || content[i].tag === 'title') &&
        && content[i].stype.indexOf('bold') == -1
      ) {
        content[i].stype = update(content[i].stype, { $push: ['bold'] });
      } else if (needBold === false
        && (content[i].tag === 'heading' || content[i].tag === 'title')
        && content[i].stype.indexOf('bold') != -1
      ) {
        content[i].stype = content[i].stype.filter(typ => typ != 'bold');
      }

      content[i].tag = tag;
      content[i].styleList = StyleSheet.flatten(this.convertStyleList(update(content[i].stype, { $push: [content[i].tag] })));
      const clearStyleList = StyleSheet.flatten(this.convertStyleList(update([], { $push: [content[i].tag] })));

      // if (content[i].NewLine === true) {
      if (true) {
        recalcText = true;
        if (tag === 'ul') {
          if (content[i].readOnly === true) {
            this.textLength -= content[i].len;
            if (i === 0) {
              content[i].text = '\u2022';
              content[i].len = 1;
            } else {
              content[i].text = '\n\u2022';
              content[i].len = 2;
            }
            this.textLength += content[i].len;

            if (fromTextChange === true && IS_IOS !== true) {
              this.androidSelectionJump += content[i].len;
            }
          } else {
            if (content[i].len > (i === 0 ? 0 : 1)) {
              content[i].text = content[i].text.substring((i === 0 ? 0 : 1));
              content[i].len = content[i].len - (i === 0 ? 0 : 1);
              content[i].NewLine = false;
              const listContent = {
                id: shortid.generate(),
                len: i === 0 ? 1 : 2,
                stype: [],
                styleList: clearStyleList,
                text: i === 0 ? '\u2022' : '\n\u2022',
                tag: 'ul',
                NewLine: true,
                readOnly: true,
              };
              content = update(content, { $splice: [[i, 0, listContent]] });
            } else if (i > 1 && content[i - 1].tag === 'ul' && content[i - 1].text.includes('\u2022')) {
              // experimental fix
              skipFromTextChangeFix = true;
              content[i].tag = 'body';
              content[i].text = '\n';
              content[i].len = 1;
              content[i].readOnly = false;
              content[i].NewLine = true;
              content[i].stype = [];
              content[i].styleList = clearStyleList;
            } else {
              content[i].text = i === 0 ? '\u2022' : '\n\u2022';
              content[i].len = i === 0 ? 1 : 2;
              content[i].readOnly = true;
              content[i].stype = [];
              content[i].styleList = clearStyleList;
            }

            this.textLength += 1;
            if (fromTextChange === true && IS_IOS !== true && !skipFromTextChangeFix) {
              this.androidSelectionJump += 1;
            }

            // }
          }
        } else if (tag === 'ol') {
          shouldReorderList = true;
          if (content[i].readOnly === true) {
            this.textLength -= content[i].len;
            if (i === 0) {
              content[i].text = '1- ';
              content[i].len = 3;
            } else {
              content[i].text = '\n1- ';
              content[i].len = 4;
            }
            this.textLength += content[i].len;
            if (fromTextChange === true && IS_IOS !== true) {
              this.androidSelectionJump += content[i].len;
            }
          } else {
            if (content[i].len > (i === 0 ? 0 : 1)) {
              content[i].text = content[i].text.substring((i === 0 ? 0 : 1));
              content[i].len = content[i].len - (i === 0 ? 0 : 1);
              content[i].NewLine = false;
              const listContent = {
                id: shortid.generate(),
                len: i === 0 ? 3 : 4,
                stype: [],
                text: i === 0 ? '1- ' : '\n1- ',
                tag: 'ol',
                NewLine: true,
                readOnly: true,
              };
              content = update(content, { $splice: [[i, 0, listContent]] });
            } else {
              content[i].text = i === 0 ? '1- ' : '\n1- ';
              content[i].len = i === 0 ? 3 : 4;
              content[i].readOnly = true;
              content[i].stype = [];
            }

            this.textLength += 3;
            if (fromTextChange === true && IS_IOS !== true) {
              this.androidSelectionJump += 3;
            }
          }
        } else if (content[i].readOnly === true) {
          
          if (i !== 0) {
            this.textLength -= (content[i].len - 1);
            content[i].text = '\n';
            content[i].len = 1;
            content[i].readOnly = false;
          } else {
            this.textLength -= content[i].len;
            if (content.length > 1 && !(content[1].NewLine === true)) {
              content = update(content, { $splice: [[i, 1]] });
              content[0].NewLine = true;
            } else {
              content[0].NewLine = true;
              content[0].readOnly = false;
              content[0].len = 0;
              content[0].text = '';
            }
          }
        }

        break;
      }
    }

    if (shouldReorderList === true) {
      recalcText = true;
      content = this.reorderList(content);
    }

    return { content, recalcText };
  };

  reorderList = (items) => {
    this.DEBUGG_COMPONENT && console.log('--- reorderList ---');

    let listNo = 1;
    for (let i = 0; i < items.length; i++) {
      const element = items[i];
      if (element.NewLine === true && element.tag === 'ol') {
        this.textLength -= element.len;
        items[i].text = i === 0 ? (`${listNo}- `) : (`\n${listNo}- `);
        items[i].len = items[i].text.length;
        this.textLength += items[i].len;
        listNo += 1;
      } else if (element.tag !== 'ol') {
        listNo = 1;
      }
    }
    return items;
  };

  convertStyleList = (stylesArr) => {
    this.DEBUGG_COMPONENT && console.log('--- convertStyleList ---');

    const styls = [];
    (stylesArr).forEach((element) => {
      const styleObj = this.txtToStyle(element);
      if (styleObj !== null) styls.push(styleObj);
    });
    return styls;
  };

  txtToStyle = (styleName) => {
    this.DEBUGG_COMPONENT && console.log('--- txtToStyle ---');

    const styles = this.props.styleList;
    return styles[styleName];
  };

  forceSelectedStyles = () => {
    this.DEBUGG_COMPONENT && console.log('--- forceSelectedStyles ---');

    const content = this.props.items;
    const { selection } = this.state;

    const { findIndx } = this.findContentIndex(content, selection.end);
    const styles = content[findIndx].stype;
    const selectedTag = content[findIndx].tag;

    if (this.props.onSelectedStyleChanged) {
      this.props.onSelectedStyleChanged(styles);
    }
    if (this.props.onSelectedTagChanged) {
      this.props.onSelectedTagChanged(selectedTag);
    }
  };

  onFocus = (e) => {
    this.DEBUGG_COMPONENT && console.log('--- onFocus ---');

    const { items, onFocus } = this.props;
    const isEmptyInput = items.length === 1 && !items[0].text;

    if (isEmptyInput && !IS_IOS) {
      this.useUpcomingMockStyles = this.getStylesByStype();
    }

    onFocus && onFocus(e);
  };

  onBlur = (e) => {
    this.DEBUGG_COMPONENT && console.log('--- onBlur ---');

    const { items, onBlur } = this.props;
    const isEmptyInput = items.length === 1 && !items[0].text;

    if (isEmptyInput && this.useUpcomingMockStyles) {
      this.useUpcomingMockStyles = null;
      this.forceUpdateWitheCalculate();
    }

    onBlur && onBlur(e);
  };

  avoidSelectionChangeOnFocus = () => {
    this.DEBUGG_COMPONENT && console.log('--- avoidSelectionChangeOnFocus ---');

    this.avoidSelectionChangeOnFocus = true;
  };

  handleKeyDown = (e) => {
    this.DEBUGG_COMPONENT && console.log('--- handleKeyDown ---');

    if (this.useUpcomingMockStyles) {
      this.useUpcomingMockStyles = null;
    }

    if (e.nativeEvent.key === 'Enter' && !IS_IOS) {
      this.enterBtnCounter += 1;
      setTimeout(() => { this.enterBtnCounter = 0; }, 200);
    }

    this.checkKeyPressAndroid += 1;
    if (e.nativeEvent.key === 'Backspace'
      && this.state.selection.start === 0
      && this.state.selection.end === 0
      && this.props.onConnectToPrevClicked
    ) {
      this.props.onConnectToPrevClicked();
    }

    if (this.props.onKeyPressHandler) {
      this.props.onKeyPressHandler(e);
    }
  };

  handleContentSizeChange = (event) => {
    this.DEBUGG_COMPONENT && console.log('--- handleContentSizeChange ---');

    if (this.props.onContentSizeChange) {
      this.props.onContentSizeChange(event);
    }
  };

  splitItems = () => {
    this.DEBUGG_COMPONENT && console.log('--- splitItems ---');

    const { selection } = this.state;
    const { items } = this.props;
    const content = items;
    const result = this.findContentIndex(content, selection.end);
    let beforeContent = [];
    let afterContent = [];

    for (let i = 0; i < result.findIndx; i++) {
      const element = content[i];
      beforeContent.push(element);
    }

    const foundElement = content[result.findIndx];
    if (result.itemNo != 0) {
      beforeContent.push({
        id: foundElement.id,
        text: foundElement.text.substring(0, result.itemNo),
        len: result.itemNo,
        stype: foundElement.stype,
        styleList: foundElement.styleList,
        tag: foundElement.tag,
        NewLine: foundElement.NewLine,
        readOnly: foundElement.readOnly,
      });
    }

    if (result.itemNo !== foundElement.len) {
      afterContent.push({
        id: (result.itemNo === 0) ? foundElement.id : shortid.generate(),
        text: foundElement.text.substring(result.itemNo, foundElement.len),
        len: foundElement.len - result.itemNo,
        stype: foundElement.stype,
        styleList: foundElement.styleList,
        tag: foundElement.tag,
        NewLine: true,
        readOnly: foundElement.readOnly,
      });
    }

    for (let i = result.findIndx + 1; i < content.length; i++) {
      const element = content[i];
      afterContent.push(element);
    }
    beforeContent = this.reorderList(beforeContent);
    afterContent = this.reorderList(afterContent);

    return {
      before: beforeContent,
      after: afterContent,
    };
  };

  focus = (selection = null) => {
    this.DEBUGG_COMPONENT && console.log('--- focus ---');

    this.textInput.focus();

    if (selection != null && selection.start && selection.end) {
      setTimeout(() => {
        this.setState({
          selection,
        });
      }, 300);
    }
  };

  blur = () => {
    this.DEBUGG_COMPONENT && console.log('--- blur ---');
    this.textInput.blur();
  };

  getStylesByStype = (stype = [], heritageStyles = {}) => {
    this.DEBUGG_COMPONENT && console.log('--- getStylesByStype ---');

    const { styleList, crossPlatformFonts } = this.props;
    let resultStyles = {...StyleSheet.flatten(
      stype.map(key => styleList[key] || null).filter(item => !!item)
    )};

    if (stype.includes('bold') && stype.includes('italic') && styleList.boldItalic) {
      resultStyles = { ...resultStyles, ...styleList.boldItalic };
    }

    if (stype.includes('underline') && stype.includes('lineThrough')) {
      resultStyles = { ...resultStyles, textDecorationLine: 'underline line-through' };
    }
    
    resultStyles = {
      ...StyleSheet.flatten(styleList.body),
      ...StyleSheet.flatten(heritageStyles),
      ...resultStyles,
    };

    if (crossPlatformFonts) {
      resultStyles.fontFamily = _.get(
        crossPlatformFonts,
        `${resultStyles.fontFamily}.font`,
        resultStyles.fontFamily
      );
    }

    return resultStyles;
  };

  render() {
    this.DEBUGG_COMPONENT && console.log('*** render CNTextInput ***');

    const { items, style, returnKeyType, styleList, textInputProps } = this.props;
    const { selection } = this.state;

    const fontDefaultStyle = (styleList && styleList.body) ? { ...StyleSheet.flatten(styleList.body) } : {};
    if (this.props.crossPlatformFonts) {
      fontDefaultStyle.fontFamily = _.get(this.props.crossPlatformFonts, 'regular.font', fontDefaultStyle.fontFamily);
    }
    // fixes for android font family
    const isEmptyInput = items.length === 1 && !items[0].text;
    const androidEmptyFont = IS_IOS ? null : { fontFamily: undefined };
    const androidFullFont = IS_IOS ? null : { fontFamily: fontDefaultStyle.fontFamily };

    return (
      <React.Fragment>
        <TextInput
          {...textInputProps}
          underlineColorAndroid="rgba(0,0,0,0)"
          onSelectionChange={this.onSelectionChange}
          multiline
          style={[fontDefaultStyle, androidEmptyFont, style]}
          scrollEnabled={false}
          returnKeyType={returnKeyType || 'next'}
          keyboardType="default"
          ref={component => this.textInput = component}
          onChangeText={this.handleChangeText}
          onKeyPress={this.handleKeyDown}
          selection={this.getSelection()}
          onFocus={this.onFocus}
          onBlur={this.onBlur}
          onContentSizeChange={this.handleContentSizeChange}
          placeholder={IS_IOS && isEmptyInput ? this.props.placeholder : undefined}
        >
          {_.map(items, (item, i, arr) => {
            const isLast = i === arr.length - 1;
            const flatStyles = this.getStylesByStype(item.stype, item.styleList);

            return(
              <React.Fragment key={item.id}>
                <CNStyledText
                  key={item.id}
                  style={flatStyles}
                  text={item.text}
                  onChangeTail={isLast ? this.props.onChangeTail : undefined}
                />
                {!!this.useUpcomingMockStyles && isLast && (
                  <Text style={this.useUpcomingMockStyles}>{HIDDEN_SYMBOL}</Text>
                )}
              </React.Fragment>
            );
          })}
        </TextInput>
        {!IS_IOS && isEmptyInput && !this.useUpcomingMockStyles && (
          <Text style={[
            fontDefaultStyle,
            style,
            { position: 'absolute', top: 2, color: textInputProps.placeholderTextColor },
          ]}>
            {this.props.placeholder}
          </Text>
        )}
      </React.Fragment>
    );
  }
}

export default CNTextInput;
