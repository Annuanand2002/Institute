# Fix MySQL Access Denied Error

## Option 1: Verify Password with MySQL Command Line

1. Open Command Prompt
2. Try to connect:
   ```bash
   mysql -u root -p
   ```
3. When prompted, enter: `Cusbay6kr0`
4. If this works, the password is correct. If not, the password is wrong.

## Option 2: Reset MySQL Root Password (if password is wrong)

### Windows - Using MySQL Command Line:

1. Stop MySQL service:
   ```bash
   net stop MySQL80
   ```
   (Replace MySQL80 with your MySQL service name - check in Services)

2. Start MySQL in safe mode (skip grant tables):
   ```bash
   mysqld --skip-grant-tables --console
   ```
   Keep this window open!

3. Open another Command Prompt and connect:
   ```bash
   mysql -u root
   ```

4. Reset password:
   ```sql
   USE mysql;
   UPDATE user SET authentication_string=PASSWORD('Cusbay6kr0') WHERE User='root';
   FLUSH PRIVILEGES;
   EXIT;
   ```

5. Stop the safe mode MySQL and restart normally.

## Option 3: Grant Permissions (if password is correct but access denied)

If you can connect with `mysql -u root -p`, run:

```sql
GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost' IDENTIFIED BY 'Cusbay6kr0' WITH GRANT OPTION;
FLUSH PRIVILEGES;
```

## Option 4: Create a New MySQL User for the Application

Instead of using root, create a dedicated user:

```sql
CREATE USER 'institute_user'@'localhost' IDENTIFIED BY 'Cusbay6kr0';
GRANT ALL PRIVILEGES ON institute.* TO 'institute_user'@'localhost';
FLUSH PRIVILEGES;
```

Then update `.env`:
```
DB_USER=institute_user
DB_PASSWORD=Cusbay6kr0
```
