module org.codehaus.mojo.frontendtest {
    requires javafx.controls;
    requires javafx.fxml;

    requires org.controlsfx.controls;
    requires org.kordamp.ikonli.javafx;
    requires javafx.graphics;

    opens org.codehaus.mojo.frontendtest to javafx.fxml;
    exports org.codehaus.mojo.frontendtest;
}