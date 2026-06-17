package org.codehaus.mojo.frontendtest;

import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.Scene;
import javafx.scene.control.ListView;
import javafx.stage.Stage;

public class RepositoryListController {
    @FXML
    private ListView<String> repoListView;
    public void initialize(){
        repoListView.getItems().addAll("project-alpha", "backend-service", "frontend-app", "test1", "test2", "test3", "test4", "test5", "test6", "test7");
    }

    @FXML
    protected void handleRepoClick(){
        String selected = repoListView.getSelectionModel().getSelectedItem();
        if (selected == null) return;

        try {
            FXMLLoader fxmlLoader = new FXMLLoader(HelloApplication.class.getResource("RepoStatusView.fxml"));
            Scene scene = new Scene(fxmlLoader.load(), 320, 240);

            Stage stage = new Stage();
            stage.setTitle(selected);
            stage.setScene(scene);
            stage.show();
        }
        catch (Exception e) {
            e.printStackTrace();
        }
    }
}
