package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

// infoCmd represents the info command
var infoCmd = &cobra.Command{
	Use:   "info",
	Short: "Information about your wallet",
	Long:  "Information about your wallet like the public key and balance.",

	Args: cobra.NoArgs,

	RunE: func(cmd *cobra.Command, args []string) error {
		wallet, err := loadWallet(devnetRPCEndpoint)
		if err != nil {
			return err
		}

		fmt.Println("Public Key: " + wallet.account.PublicKey.ToBase58())
		balance, err := wallet.getBalance()
		if err != nil {
			return err
		}

		fmt.Printf("Balance: %s\n", fmtLamports(balance))
		return nil
	},
}

func init() {
	rootCmd.AddCommand(infoCmd)
}
