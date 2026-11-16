package com.aiminicrossword.app;

import android.content.Context;
import android.text.InputType;
import android.util.AttributeSet;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import com.getcapacitor.CapacitorWebView;

/**
 * The window that shows the game, with one change: the keyboard does not
 * suggest words.
 *
 * Android keyboards show a row of suggested words ("S | SO | SHE") above the
 * keys while typing. In a crossword that gives answers away. Keyboards only
 * reliably switch that row off for one kind of text box, the "visible
 * password" kind, where the typed letters are still shown normally. So every
 * text box in the game is described to the keyboard as that kind.
 *
 * res/layout/capacitor_bridge_layout_main.xml tells the app to use this class.
 */
public class CrosswordWebView extends CapacitorWebView {

    public CrosswordWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    public InputConnection onCreateInputConnection(EditorInfo outAttrs) {
        InputConnection connection = super.onCreateInputConnection(outAttrs);
        boolean isTextBox = (outAttrs.inputType & InputType.TYPE_MASK_CLASS) == InputType.TYPE_CLASS_TEXT;
        if (connection != null && isTextBox) {
            // keep the "start with capital letters" wish of the text box
            int capitals =
                outAttrs.inputType &
                (InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS | InputType.TYPE_TEXT_FLAG_CAP_WORDS | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
            outAttrs.inputType =
                InputType.TYPE_CLASS_TEXT |
                InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD |
                InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS |
                capitals;
        }
        return connection;
    }
}
