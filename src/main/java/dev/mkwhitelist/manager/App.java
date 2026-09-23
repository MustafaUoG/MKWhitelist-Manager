package dev.mkwhitelist.manager;

import javafx.application.Application;
import javafx.collections.transformation.FilteredList;
import javafx.scene.Scene;
import javafx.scene.control.*;
import javafx.scene.layout.HBox;
import javafx.scene.layout.StackPane;
import javafx.stage.Stage;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.scene.layout.VBox;
import javafx.scene.control.cell.PropertyValueFactory;
import javafx.geometry.Insets;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.sql.PreparedStatement;
import javafx.scene.image.Image;
import javafx.stage.FileChooser;
import java.nio.file.Files;


import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Optional;
import java.util.List;
import java.util.ArrayList;

public class App extends Application {

    private String dbPath;

    private boolean isDarkMode = true;

    @Override

    public void start(Stage primaryStage) {

        dbPath = loadSavedDbPath();
        if (dbPath == null) {
            FileChooser fileChooser = new FileChooser();
            fileChooser.setTitle("Select your linked_accounts.db file");
            fileChooser.getExtensionFilters().add(new FileChooser.ExtensionFilter("SQLite Database", "*.db"));

            File selectedFile = fileChooser.showOpenDialog(primaryStage);

            if (selectedFile == null){
                System.exit(0);
            }

            dbPath = selectedFile.getAbsolutePath();
            saveDbPath(dbPath);
        }

        TableView<LinkedAccount> table = new TableView<>();

        TableColumn<LinkedAccount, String> uuidColumn = new TableColumn<>("Minecraft UUID");
        uuidColumn.setCellValueFactory(new PropertyValueFactory<>("minecraftUuid"));
        uuidColumn.setPrefWidth(250);


        TableColumn<LinkedAccount, String> discordColumn = new TableColumn<>("Discord ID");
        discordColumn.setCellValueFactory(new PropertyValueFactory<>("discordId"));
        discordColumn.setPrefWidth(200);

        table.getColumns().add(uuidColumn);
        table.getColumns().add(discordColumn);
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);

        ObservableList<LinkedAccount> accounts = loadAccountsFromDatabase();
        FilteredList<LinkedAccount> filteredAccounts = new FilteredList<>(accounts, p -> true);
        table.setItems(filteredAccounts);

        TextField searchField = new TextField();
        searchField.setPromptText("Search by UUID or Discord ID...");

        searchField.textProperty().addListener((observable, oldValue, newValue) ->
        {
            filteredAccounts.setPredicate(account -> {
                if (newValue == null || newValue.isBlank()){
                    return true;
                }
                String lowerSearch = newValue.toLowerCase();
                return account.getMinecraftUuid().toLowerCase().contains(lowerSearch) || account.getDiscordId().toLowerCase().contains(lowerSearch);
            }
            );
        }
        );

        Button unlinkButton = new Button("Unlink Selected");
        unlinkButton.setOnAction(event -> { LinkedAccount selected = table.getSelectionModel().getSelectedItem();
            if (selected != null){
                Alert confirmAlert = new Alert(Alert.AlertType.CONFIRMATION);
                confirmAlert.setTitle("Confirm Unlink");
                confirmAlert.setHeaderText("Unlink this account?");
                confirmAlert.setContentText("Minecraft UUID: " + selected.getMinecraftUuid() +  "\nDiscord ID: " + selected.getDiscordId() + "\n\nThis player will need to link again to rejoin.");

                Optional<ButtonType> result = confirmAlert.showAndWait();

                if (result.isPresent() && result.get() == ButtonType.OK) {
                    unlinkAccount(selected, accounts);
                }
            }
        }
        );

        Button refreshButton = new Button("Refresh");
        refreshButton.setOnAction(event -> { accounts.setAll(loadAccountsFromDatabase());
        }
        );


        HBox controls = new HBox(10, searchField, unlinkButton, refreshButton);
        VBox accountsRoot = new VBox(10, controls, table);
        accountsRoot.setPadding(new Insets(10));

        Tab accountsTab = new Tab("Accounts");
        accountsTab.setContent(accountsRoot);

        Tab settingsTab = new Tab("Settings");
        settingsTab.setContent(buildSettingPane());

        TabPane tabPane = new TabPane(accountsTab, settingsTab);
        tabPane.setTabClosingPolicy(TabPane.TabClosingPolicy.UNAVAILABLE);


        Scene scene = new Scene(tabPane, 500, 400);

        Button themeToggleButton = new Button("Toggle Theme");
        themeToggleButton.setOnAction(event -> toggleTheme(scene));
        controls.getChildren().add(themeToggleButton);

        primaryStage.setTitle("MKWhitelist Manager");
        primaryStage.setScene(scene);
        scene.getStylesheets().add(getClass().getResource("/dark-theme.css").toExternalForm());
        primaryStage.getIcons().add(new Image(getClass().getResourceAsStream("/icon.png")));
        primaryStage.show();
    }

    private ObservableList<LinkedAccount> loadAccountsFromDatabase() {
        ObservableList<LinkedAccount> accounts = FXCollections.observableArrayList();

        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + dbPath);
             Statement statement = connection.createStatement()) {
            ResultSet resultSet = statement.executeQuery("SELECT minecraft_uuid, discord_id FROM linked_accounts;");

            while(resultSet.next()){

                String uuid = resultSet.getString("minecraft_uuid");
                String discordId = resultSet.getString("discord_id");
                accounts.add(new LinkedAccount(uuid, discordId));

            }
        }   catch (Exception e) {
                System.err.println("Failed to load accounts: " + e.getMessage());
        }

        return accounts;
    }

    private void unlinkAccount(LinkedAccount account, ObservableList<LinkedAccount> accounts){
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + dbPath);
            PreparedStatement statement = connection.prepareStatement("DELETE FROM linked_accounts WHERE minecraft_uuid = ?;")){

            statement.setString(1, account.getMinecraftUuid());
            statement.executeUpdate();

            accounts.remove(account);
        }   catch (Exception e){
            System.err.println("Failed to unlink account: " + e.getMessage());
        }
    }

    private String loadSavedDbPath(){
        File settingFile = new File("mkwhitelist-manager-settings.txt");
        if (settingFile.exists()){
            try {
                return Files.readString(settingFile.toPath()).trim();
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }

    private void saveDbPath(String path){
        try {
            Files.writeString(new File("mkwhitelist-manager-settings.txt").toPath(), path);
        } catch (Exception e) {
            System.err.println("Failed to save settings: " + e.getMessage());
        }
    }

    private void toggleTheme(Scene scene){
        isDarkMode = !isDarkMode;
        scene.getStylesheets().clear();

        String cssFile = isDarkMode ? "/dark-theme.css" : "/light-theme.css";
        scene.getStylesheets().add(getClass().getResource(cssFile).toExternalForm());
    }

    private VBox buildSettingPane(){
        String configPath = new File(dbPath).getParent() + "/config.yml";

        TextField tokenField = new TextField();
        TextField guildIdField = new TextField();
        loadConfigValues(configPath, tokenField, guildIdField);

        Button saveButton = new Button("Save");
        saveButton.setOnAction(event -> {
            saveConfigValues(configPath, tokenField.getText(), guildIdField.getText());
            showInfoAlert("Saved", "Restart your Minecraft server for the changes to take effect");
        });

        VBox pane = new  VBox(10,new Label("Discord Bot Token:"), tokenField, new Label("Discord Guild ID:"), guildIdField, saveButton);

        pane.setPadding(new Insets(15));
        return pane;
    }

    private void loadConfigValues(String configPath, TextField tokenField, TextField guildId){
        try{
            List<String> lines = Files.readAllLines(new File(configPath).toPath());
            for (String line : lines){
                String trimmed = line.trim();
                if (trimmed.startsWith("bot-token:")){
                    tokenField.setText(extractValue(trimmed));
                } else if (trimmed.startsWith("guild-id:")) {
                    guildId.setText(extractValue(trimmed));
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to load config" + e.getMessage());
        }
    }

    private String extractValue(String line){
        String value = line.substring(line.indexOf(":") + 1).trim();
        if (value.startsWith("\"") &&  value.endsWith("\"") && value.length() >= 2){
            value = value.substring(1, value.length() - 1);
        }
        return value;
    }

    private void saveConfigValues(String configPath, String newToken, String newGuildId){
        try {
            File configFile = new File(configPath);
            List<String> lines = Files.readAllLines(configFile.toPath());
            List<String> updatedLines = new ArrayList<>();

            for(String line : lines){
                String trimmed = line.trim();
                if (trimmed.startsWith("bot-token: ")){
                    updatedLines.add(replaceValue(line, newToken));
                } else if (trimmed.startsWith("guild-id:")){
                    updatedLines.add(replaceValue(line, newGuildId));
                } else {
                    updatedLines.add(line);
                }
            }

            Files.write(configFile.toPath(), updatedLines);
        } catch (Exception e) {
            System.err.println("Failed to save config: " + e.getMessage());
        }
    }

    private String replaceValue(String originalLine, String newValue){
        int indentLength = originalLine.indexOf(originalLine.trim());
        String prefix = originalLine.substring(0, indentLength);
        String key = originalLine.trim().substring(0, originalLine.trim().indexOf(":") + 1);
        return prefix + key + " \"" + newValue + "\"";
    }

    private void showInfoAlert(String title, String message){
        Alert alert = new Alert(Alert.AlertType.INFORMATION);
        alert.setTitle(title);
        alert.setHeaderText(null);
        alert.setContentText(message);
        alert.showAndWait();
    }

    public static void main(String[] args){
        launch(args);
    }
}
