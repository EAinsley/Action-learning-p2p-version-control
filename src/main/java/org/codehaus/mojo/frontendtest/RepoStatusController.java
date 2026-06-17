package org.codehaus.mojo.frontendtest;

import javafx.fxml.FXML;
import javafx.scene.control.ListView;

public class RepoStatusController {
    @FXML
    private ListView<String> filesListView;
    public void initialize(){
        filesListView.getItems().addAll("bungus", "Control", "note.txt");
    }
}
